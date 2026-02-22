import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SocialPlatform, SocialPublishStatus } from '@prisma/client';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { integrationCredentialsService } from './integration-credentials.service.js';
import { linkedinService } from './linkedin.service.js';
import { socialOAuthService } from './social-oauth.service.js';
import { socialPublishService } from './social-publish.service.js';

const publishBodySchema = z.object({
    content: z.string().min(1),
    draftId: z.string().optional(),
    maxAttempts: z.number().int().min(1).max(10).optional(),
});

const oauthStartQuerySchema = z.object({
    returnTo: z.string().optional(),
});

const oauthCallbackQuerySchema = z.object({
    state: z.string().optional(),
    code: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
});

const listJobsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    platform: z.nativeEnum(SocialPlatform).optional(),
    status: z.nativeEnum(SocialPublishStatus).optional(),
});

async function getAuthContext(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ organizationId: string }>();
    return { organizationId: decoded.organizationId };
}

function buildReturnUrl(returnTo: string, query: Record<string, string>) {
    const target = new URL(returnTo, env.FRONTEND_URL);
    for (const [key, value] of Object.entries(query)) {
        target.searchParams.set(key, value);
    }
    return target.toString();
}

async function handleOAuthCallback(
    provider: 'twitter' | 'linkedin',
    request: FastifyRequest,
    reply: FastifyReply
) {
    const query = oauthCallbackQuerySchema.parse(request.query ?? {});

    let statePayload:
        | {
            provider: 'twitter' | 'linkedin';
            organizationId: string;
            returnTo: string;
            codeVerifier?: string | undefined;
            createdAt: string;
        }
        | undefined;

    if (query.state) {
        try {
            statePayload = await socialOAuthService.consumeState(provider, query.state);
        } catch {
            statePayload = undefined;
        }
    }

    if (query.error) {
        const returnTo = statePayload?.returnTo || '/growth';
        const url = buildReturnUrl(returnTo, {
            oauth: provider,
            status: 'error',
            message: query.error_description || query.error,
        });
        return reply.redirect(url);
    }

    if (!query.state || !query.code) {
        const url = buildReturnUrl('/growth', {
            oauth: provider,
            status: 'error',
            message: 'Missing OAuth callback parameters',
        });
        return reply.redirect(url);
    }

    if (!statePayload) {
        const url = buildReturnUrl('/growth', {
            oauth: provider,
            status: 'error',
            message: 'OAuth state is invalid or expired',
        });
        return reply.redirect(url);
    }

    try {
        const tokenPayload = await socialOAuthService.exchangeCode({
            provider,
            callback: {
                state: query.state,
                code: query.code,
            },
            codeVerifier: statePayload.codeVerifier,
        });

        if (provider === 'twitter') {
            await integrationCredentialsService.patchApiKeys(statePayload.organizationId, {
                twitterAccessToken: tokenPayload.accessToken,
                twitterRefreshToken: tokenPayload.refreshToken,
                twitterTokenExpiresAt: tokenPayload.expiresAt,
                twitterTokenScope: tokenPayload.scope,
            });
        } else {
            let linkedinAuthorUrn: string | undefined;
            try {
                linkedinAuthorUrn = await linkedinService.resolveAuthorUrn(tokenPayload.accessToken);
            } catch {
                linkedinAuthorUrn = undefined;
            }

            await integrationCredentialsService.patchApiKeys(statePayload.organizationId, {
                linkedinAccessToken: tokenPayload.accessToken,
                linkedinRefreshToken: tokenPayload.refreshToken,
                linkedinTokenExpiresAt: tokenPayload.expiresAt,
                linkedinTokenScope: tokenPayload.scope,
                linkedinAuthorUrn,
            });
        }

        const successUrl = buildReturnUrl(statePayload.returnTo, {
            oauth: provider,
            status: 'connected',
        });
        return reply.redirect(successUrl);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'OAuth callback failed';
        const errorUrl = buildReturnUrl(statePayload.returnTo || '/growth', {
            oauth: provider,
            status: 'error',
            message,
        });
        return reply.redirect(errorUrl);
    }
}

function buildConnectionStatus(apiKeys: Record<string, string>) {
    const twitterConnected = Boolean(apiKeys.twitterAccessToken);
    const linkedinConnected = Boolean(apiKeys.linkedinAccessToken);

    return {
        twitterConnected,
        linkedinConnected,
        twitter: {
            connected: twitterConnected,
            expiresAt: apiKeys.twitterTokenExpiresAt || null,
            hasRefreshToken: Boolean(apiKeys.twitterRefreshToken),
            scope: apiKeys.twitterTokenScope || null,
        },
        linkedin: {
            connected: linkedinConnected,
            expiresAt: apiKeys.linkedinTokenExpiresAt || null,
            hasRefreshToken: Boolean(apiKeys.linkedinRefreshToken),
            scope: apiKeys.linkedinTokenScope || null,
            authorUrn: apiKeys.linkedinAuthorUrn || null,
        },
    };
}

export async function integrationsRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/status',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                const apiKeys = await integrationCredentialsService.getApiKeys(context.organizationId);
                const connection = buildConnectionStatus(apiKeys);
                const publishQueue = await socialPublishService.getQueueSummary(context.organizationId);

                return reply.send({
                    success: true,
                    data: {
                        ...connection,
                        publishQueue,
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load integrations status',
                });
            }
        }
    );

    fastify.get(
        '/twitter/oauth/start',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                const query = oauthStartQuerySchema.parse(request.query ?? {});
                const data = await socialOAuthService.createAuthorizationUrl({
                    provider: 'twitter',
                    organizationId: context.organizationId,
                    returnTo: query.returnTo,
                });

                return reply.send({
                    success: true,
                    data,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to start Twitter OAuth',
                });
            }
        }
    );

    fastify.get(
        '/linkedin/oauth/start',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                const query = oauthStartQuerySchema.parse(request.query ?? {});
                const data = await socialOAuthService.createAuthorizationUrl({
                    provider: 'linkedin',
                    organizationId: context.organizationId,
                    returnTo: query.returnTo,
                });

                return reply.send({
                    success: true,
                    data,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to start LinkedIn OAuth',
                });
            }
        }
    );

    fastify.get('/twitter/oauth/callback', async (request, reply) => {
        return handleOAuthCallback('twitter', request, reply);
    });

    fastify.get('/linkedin/oauth/callback', async (request, reply) => {
        return handleOAuthCallback('linkedin', request, reply);
    });

    fastify.post(
        '/twitter/disconnect',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                await integrationCredentialsService.clearProviderKeys(context.organizationId, 'twitter');
                return reply.send({
                    success: true,
                    data: { disconnected: true },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to disconnect Twitter',
                });
            }
        }
    );

    fastify.post(
        '/linkedin/disconnect',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                await integrationCredentialsService.clearProviderKeys(context.organizationId, 'linkedin');
                return reply.send({
                    success: true,
                    data: { disconnected: true },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to disconnect LinkedIn',
                });
            }
        }
    );

    fastify.post(
        '/twitter/publish',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                const body = publishBodySchema.parse(request.body ?? {});
                const publishJob = await socialPublishService.enqueuePublish({
                    organizationId: context.organizationId,
                    platform: SocialPlatform.TWITTER,
                    content: body.content,
                    draftId: body.draftId,
                    maxAttempts: body.maxAttempts,
                });

                return reply.send({
                    success: true,
                    data: {
                        jobId: publishJob.id,
                        status: publishJob.status,
                        platform: publishJob.platform,
                        queuedAt: publishJob.queuedAt,
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to enqueue Twitter publish',
                });
            }
        }
    );

    fastify.post(
        '/linkedin/publish',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                const body = publishBodySchema.parse(request.body ?? {});
                const publishJob = await socialPublishService.enqueuePublish({
                    organizationId: context.organizationId,
                    platform: SocialPlatform.LINKEDIN,
                    content: body.content,
                    draftId: body.draftId,
                    maxAttempts: body.maxAttempts,
                });

                return reply.send({
                    success: true,
                    data: {
                        jobId: publishJob.id,
                        status: publishJob.status,
                        platform: publishJob.platform,
                        queuedAt: publishJob.queuedAt,
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to enqueue LinkedIn publish',
                });
            }
        }
    );

    fastify.get(
        '/publish-jobs',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getAuthContext(request);
                const query = listJobsQuerySchema.parse(request.query ?? {});
                const data = await socialPublishService.listPublishJobs(context.organizationId, query);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list publish jobs',
                });
            }
        }
    );

    fastify.get<{ Params: { id: string } }>(
        '/publish-jobs/:id',
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            try {
                const context = await getAuthContext(request);
                const data = await socialPublishService.getPublishJob(
                    context.organizationId,
                    request.params.id
                );
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(404).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Publish job not found',
                });
            }
        }
    );

    fastify.post<{ Params: { id: string } }>(
        '/publish-jobs/:id/retry',
        { onRequest: [fastify.authenticate] },
        async (request, reply) => {
            try {
                const context = await getAuthContext(request);
                const data = await socialPublishService.retryPublishJob(
                    context.organizationId,
                    request.params.id
                );
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to retry publish job',
                });
            }
        }
    );
}

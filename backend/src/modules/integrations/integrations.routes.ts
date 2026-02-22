import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { decryptStringMap } from '../../lib/secrets.js';
import { linkedinService } from './linkedin.service.js';
import { twitterService } from './twitter.service.js';

const publishBodySchema = z.object({
    content: z.string().min(1),
    draftId: z.string().optional(),
    authorUrn: z.string().optional(),
});

async function getContext(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ organizationId: string }>();
    const org = await prisma.organization.findUnique({
        where: {
            id: decoded.organizationId,
        },
        select: {
            id: true,
            apiKeys: true,
        },
    });

    if (!org) {
        throw new Error('Organization not found');
    }

    const apiKeys = decryptStringMap((org.apiKeys || undefined) as Record<string, string> | undefined) || {};

    return {
        organizationId: decoded.organizationId,
        apiKeys,
    };
}

export async function integrationsRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/status',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const context = await getContext(request);
                return reply.send({
                    success: true,
                    data: {
                        twitterConnected: Boolean(context.apiKeys.twitterAccessToken),
                        linkedinConnected: Boolean(context.apiKeys.linkedinAccessToken),
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

    fastify.post(
        '/twitter/publish',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const body = publishBodySchema.parse(request.body ?? {});
                const context = await getContext(request);
                const result = await twitterService.publish({
                    content: body.content,
                    accessToken: context.apiKeys.twitterAccessToken,
                });

                if (body.draftId) {
                    await prisma.distributionDraft.updateMany({
                        where: {
                            id: body.draftId,
                            organizationId: context.organizationId,
                        },
                        data: {
                            platform: 'twitter',
                            status: 'PUBLISHED',
                            publishedAt: new Date(),
                        },
                    });
                }

                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to publish on Twitter',
                });
            }
        }
    );

    fastify.post(
        '/linkedin/publish',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const body = publishBodySchema.parse(request.body ?? {});
                const context = await getContext(request);
                const result = await linkedinService.publish({
                    content: body.content,
                    accessToken: context.apiKeys.linkedinAccessToken,
                    authorUrn: body.authorUrn || context.apiKeys.linkedinAuthorUrn,
                });

                if (body.draftId) {
                    await prisma.distributionDraft.updateMany({
                        where: {
                            id: body.draftId,
                            organizationId: context.organizationId,
                        },
                        data: {
                            platform: 'linkedin',
                            status: 'PUBLISHED',
                            publishedAt: new Date(),
                        },
                    });
                }

                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to publish on LinkedIn',
                });
            }
        }
    );
}

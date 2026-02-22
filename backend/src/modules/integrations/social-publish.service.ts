import { Prisma, SocialPlatform, SocialPublishStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { socialPublishQueue } from '../../lib/queue.js';
import { integrationCredentialsService } from './integration-credentials.service.js';
import { linkedinService } from './linkedin.service.js';
import { socialOAuthService } from './social-oauth.service.js';
import { twitterService } from './twitter.service.js';

interface EnqueuePublishInput {
    organizationId: string;
    platform: SocialPlatform;
    content: string;
    draftId?: string;
    maxAttempts?: number;
    metadata?: Prisma.InputJsonValue;
}

interface ListPublishJobsQuery {
    page: number;
    limit: number;
    platform?: SocialPlatform;
    status?: SocialPublishStatus;
}

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function clampAttempts(value?: number) {
    if (!value) {
        return 5;
    }
    return Math.max(1, Math.min(10, value));
}

function isExpiringSoon(expiresAt?: string, bufferMs = 120000) {
    if (!expiresAt) {
        return false;
    }
    const parsed = new Date(expiresAt).getTime();
    if (!Number.isFinite(parsed)) {
        return false;
    }
    return parsed - Date.now() <= bufferMs;
}

export class SocialPublishService {
    async enqueuePublish(input: EnqueuePublishInput) {
        const content = input.content.trim();
        if (!content) {
            throw new Error('Content is required');
        }

        const maxAttempts = clampAttempts(input.maxAttempts);

        const publishJob = await prisma.socialPublishJob.create({
            data: {
                organizationId: input.organizationId,
                draftId: input.draftId,
                platform: input.platform,
                content,
                status: SocialPublishStatus.QUEUED,
                maxAttempts,
                metadata: input.metadata,
            },
        });

        await socialPublishQueue.add(
            'publish',
            { publishJobId: publishJob.id },
            {
                attempts: maxAttempts,
                backoff: {
                    type: 'exponential',
                    delay: 8000,
                },
                removeOnComplete: 100,
                removeOnFail: 200,
            }
        );

        return publishJob;
    }

    async listPublishJobs(organizationId: string, query: ListPublishJobsQuery) {
        const page = Math.max(1, query.page);
        const limit = Math.max(1, Math.min(100, query.limit));
        const skip = (page - 1) * limit;

        const where: Prisma.SocialPublishJobWhereInput = {
            organizationId,
        };

        if (query.platform) {
            where.platform = query.platform;
        }
        if (query.status) {
            where.status = query.status;
        }

        const [items, total] = await Promise.all([
            prisma.socialPublishJob.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }],
                skip,
                take: limit,
            }),
            prisma.socialPublishJob.count({ where }),
        ]);

        return {
            items,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async getPublishJob(organizationId: string, publishJobId: string) {
        const publishJob = await prisma.socialPublishJob.findFirst({
            where: {
                id: publishJobId,
                organizationId,
            },
        });

        if (!publishJob) {
            throw new Error('Publish job not found');
        }

        return publishJob;
    }

    async retryPublishJob(organizationId: string, publishJobId: string) {
        const publishJob = await this.getPublishJob(organizationId, publishJobId);
        if (publishJob.status !== SocialPublishStatus.FAILED) {
            throw new Error('Only failed publish jobs can be retried');
        }

        await prisma.socialPublishJob.update({
            where: { id: publishJob.id },
            data: {
                status: SocialPublishStatus.QUEUED,
                errorMessage: null,
                processedAt: null,
            },
        });

        await socialPublishQueue.add(
            'publish',
            { publishJobId: publishJob.id },
            {
                attempts: publishJob.maxAttempts,
                backoff: {
                    type: 'exponential',
                    delay: 8000,
                },
                removeOnComplete: 100,
                removeOnFail: 200,
            }
        );

        return this.getPublishJob(organizationId, publishJobId);
    }

    async getQueueSummary(organizationId: string) {
        const [queued, processing, failed, success] = await Promise.all([
            prisma.socialPublishJob.count({
                where: { organizationId, status: SocialPublishStatus.QUEUED },
            }),
            prisma.socialPublishJob.count({
                where: { organizationId, status: SocialPublishStatus.PROCESSING },
            }),
            prisma.socialPublishJob.count({
                where: { organizationId, status: SocialPublishStatus.FAILED },
            }),
            prisma.socialPublishJob.count({
                where: { organizationId, status: SocialPublishStatus.SUCCESS },
            }),
        ]);

        return {
            queued,
            processing,
            failed,
            success,
        };
    }

    async processQueuedJob(publishJobId: string, attemptsMade: number) {
        const publishJob = await prisma.socialPublishJob.findUnique({
            where: { id: publishJobId },
        });

        if (!publishJob) {
            throw new Error('Publish job not found');
        }

        await prisma.socialPublishJob.update({
            where: { id: publishJob.id },
            data: {
                status: SocialPublishStatus.PROCESSING,
                attempts: Math.max(publishJob.attempts, attemptsMade + 1),
                errorMessage: null,
            },
        });

        try {
            const credentials = await this.ensureCredentials(
                publishJob.organizationId,
                publishJob.platform
            );

            const result =
                publishJob.platform === SocialPlatform.TWITTER
                    ? await twitterService.publish({
                        content: publishJob.content,
                        accessToken: credentials.accessToken,
                    })
                    : await linkedinService.publish({
                        content: publishJob.content,
                        accessToken: credentials.accessToken,
                        authorUrn: credentials.authorUrn,
                    });

            await prisma.socialPublishJob.update({
                where: { id: publishJob.id },
                data: {
                    status: SocialPublishStatus.SUCCESS,
                    externalPostId: result.postId,
                    processedAt: new Date(),
                    metadata: {
                        ...(publishJob.metadata as Prisma.JsonObject | null),
                        result,
                    },
                },
            });

            if (publishJob.draftId) {
                await prisma.distributionDraft.updateMany({
                    where: {
                        id: publishJob.draftId,
                        organizationId: publishJob.organizationId,
                    },
                    data: {
                        status: 'PUBLISHED',
                        platform:
                            publishJob.platform === SocialPlatform.TWITTER ? 'twitter' : 'linkedin',
                        publishedAt: new Date(),
                    },
                });
            }

            return result;
        } catch (error) {
            const message = normalizeErrorMessage(error);
            const willRetry = attemptsMade + 1 < publishJob.maxAttempts;

            await prisma.socialPublishJob.update({
                where: { id: publishJob.id },
                data: {
                    status: willRetry ? SocialPublishStatus.QUEUED : SocialPublishStatus.FAILED,
                    errorMessage: message.slice(0, 1000),
                    processedAt: willRetry ? null : new Date(),
                },
            });

            throw error;
        }
    }

    private async ensureCredentials(organizationId: string, platform: SocialPlatform) {
        const apiKeys = await integrationCredentialsService.getApiKeys(organizationId);

        if (platform === SocialPlatform.TWITTER) {
            let accessToken = apiKeys.twitterAccessToken;
            const refreshToken = apiKeys.twitterRefreshToken;
            const expiresAt = apiKeys.twitterTokenExpiresAt;

            if (!accessToken) {
                throw new Error('Twitter account is not connected');
            }

            if (isExpiringSoon(expiresAt)) {
                if (!refreshToken) {
                    throw new Error('Twitter access token expired and no refresh token is available');
                }

                const refreshed = await socialOAuthService.refreshAccessToken({
                    provider: 'twitter',
                    refreshToken,
                });

                accessToken = refreshed.accessToken;

                await integrationCredentialsService.patchApiKeys(organizationId, {
                    twitterAccessToken: refreshed.accessToken,
                    twitterRefreshToken: refreshed.refreshToken || refreshToken,
                    twitterTokenExpiresAt: refreshed.expiresAt,
                    twitterTokenScope: refreshed.scope,
                });
            }

            return { accessToken };
        }

        let accessToken = apiKeys.linkedinAccessToken;
        const refreshToken = apiKeys.linkedinRefreshToken;
        const expiresAt = apiKeys.linkedinTokenExpiresAt;
        let authorUrn = apiKeys.linkedinAuthorUrn;

        if (!accessToken) {
            throw new Error('LinkedIn account is not connected');
        }

        if (isExpiringSoon(expiresAt)) {
            if (!refreshToken) {
                throw new Error('LinkedIn access token expired and no refresh token is available');
            }

            const refreshed = await socialOAuthService.refreshAccessToken({
                provider: 'linkedin',
                refreshToken,
            });

            accessToken = refreshed.accessToken;

            await integrationCredentialsService.patchApiKeys(organizationId, {
                linkedinAccessToken: refreshed.accessToken,
                linkedinRefreshToken: refreshed.refreshToken || refreshToken,
                linkedinTokenExpiresAt: refreshed.expiresAt,
                linkedinTokenScope: refreshed.scope,
            });
        }

        if (!authorUrn) {
            authorUrn = await linkedinService.resolveAuthorUrn(accessToken);
            await integrationCredentialsService.patchApiKeys(organizationId, {
                linkedinAuthorUrn: authorUrn,
            });
        }

        return { accessToken, authorUrn };
    }
}

export const socialPublishService = new SocialPublishService();

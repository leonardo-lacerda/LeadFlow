import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { analyticsQueue } from '../../lib/queue.js';
import { analyticsService } from './analytics.service.js';

const performanceDaysQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(60),
});

const responseTimeDaysQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).default(120),
});

const recentActivityQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

const campaignsQuerySchema = z.object({
    campaignId: z.string().optional(),
});

const recalculateBodySchema = z.object({
    campaignId: z.string().optional(),
});

async function getOrganizationId(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ organizationId: string }>();
    return decoded.organizationId;
}

export async function analyticsRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/stats',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const stats = await analyticsService.getDashboardStats(organizationId);
                return reply.send({ success: true, data: stats });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch analytics stats',
                });
            }
        }
    );

    fastify.get(
        '/source-performance',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await analyticsService.getSourcePerformance(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch source performance',
                });
            }
        }
    );

    fastify.get(
        '/message-performance',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = performanceDaysQuerySchema.parse(request.query ?? {});
                const data = await analyticsService.getMessagePerformance(
                    organizationId,
                    query.days
                );
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch message performance',
                });
            }
        }
    );

    fastify.get(
        '/timing-heatmap',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = performanceDaysQuerySchema.parse(request.query ?? {});
                const data = await analyticsService.getTimingHeatmap(organizationId, query.days);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch timing heatmap',
                });
            }
        }
    );

    fastify.get(
        '/response-time',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = responseTimeDaysQuerySchema.parse(request.query ?? {});
                const data = await analyticsService.getResponseTime(organizationId, query.days);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch response time',
                });
            }
        }
    );

    fastify.get(
        '/score-correlation',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await analyticsService.getScoreCorrelation(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch score correlation',
                });
            }
        }
    );

    fastify.get(
        '/funnel',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await analyticsService.getFunnel(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch funnel analytics',
                });
            }
        }
    );

    fastify.post(
        '/recalculate',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const body = recalculateBodySchema.parse(request.body ?? {});
                const job = await analyticsQueue.add(
                    'recalculate_metrics',
                    {
                        organizationId,
                        campaignId: body.campaignId,
                    },
                    {
                        removeOnComplete: true,
                        removeOnFail: true,
                    }
                );

                return reply.code(202).send({
                    success: true,
                    data: { jobId: String(job.id), queued: true },
                });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to enqueue analytics recalculation',
                });
            }
        }
    );

    fastify.get(
        '/recent-activity',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = recentActivityQuerySchema.parse(request.query ?? {});
                const activities = await analyticsService.getRecentActivity(
                    organizationId,
                    query.limit
                );
                return reply.send({ success: true, data: activities });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch recent activity',
                });
            }
        }
    );

    fastify.get(
        '/campaigns',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = campaignsQuerySchema.parse(request.query ?? {});
                const campaignAnalytics = await analyticsService.getCampaignAnalytics(
                    organizationId,
                    query.campaignId
                );
                return reply.send({ success: true, data: campaignAnalytics });
            } catch (error) {
                request.log.error(error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to fetch campaign analytics',
                });
            }
        }
    );
}

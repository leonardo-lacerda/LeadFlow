import { SignalStatus, SignalType } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { signalDetectorQueue } from '../../lib/queue.js';
import { signalLayerService } from './signal-layer.service.js';
import { signalService } from './signal.service.js';

const leadRecommendationParamsSchema = z.object({
    leadId: z.string().min(1),
});

const campaignRecommendationParamsSchema = z.object({
    campaignId: z.string().min(1),
});

const leadRecommendationsBodySchema = z.object({
    leadIds: z.array(z.string().min(1)).min(1).max(200),
});

const actionableAlertsQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(50).default(12),
});

const backfillBodySchema = z.object({
    limit: z.coerce.number().int().positive().max(10000).default(1500),
});

const listSignalsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    type: z.nativeEnum(SignalType).optional(),
    status: z.nativeEnum(SignalStatus).optional(),
    minConfidence: z.coerce.number().int().min(0).max(100).optional(),
});

const detectSignalsBodySchema = z.object({
    minConfidence: z.coerce.number().int().min(0).max(100).optional(),
    async: z.boolean().default(true),
});

const signalStatusParamsSchema = z.object({
    signalId: z.string().min(1),
});

const signalStatusBodySchema = z.object({
    status: z.nativeEnum(SignalStatus),
});

async function getOrganizationId(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ organizationId: string }>();
    return decoded.organizationId;
}

export async function signalsRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = listSignalsQuerySchema.parse(request.query ?? {});
                const data = await signalService.listSignals(organizationId, query);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list signals',
                });
            }
        }
    );

    fastify.get(
        '/summary',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await signalService.getSignalSummary(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(500).send({
                    success: false,
                    error: 'Failed to fetch signal summary',
                });
            }
        }
    );

    fastify.post(
        '/detect',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const body = detectSignalsBodySchema.parse(request.body ?? {});

                if (!body.async) {
                    const data = await signalService.runDetectionForOrganization(organizationId, {
                        minConfidence: body.minConfidence,
                    });
                    return reply.send({ success: true, data });
                }

                const job = await signalDetectorQueue.add(
                    'detect_signals',
                    {
                        organizationId,
                        minConfidence: body.minConfidence,
                    },
                    {
                        removeOnComplete: 50,
                        removeOnFail: 50,
                    }
                );

                return reply.code(202).send({
                    success: true,
                    data: {
                        queued: true,
                        jobId: String(job.id),
                    },
                });
            } catch (error) {
                request.log.error(error);
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to run signal detection',
                });
            }
        }
    );

    fastify.patch(
        '/:signalId/status',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = signalStatusParamsSchema.parse(request.params);
                const body = signalStatusBodySchema.parse(request.body ?? {});
                const data = await signalService.updateSignalStatus(
                    organizationId,
                    params.signalId,
                    body.status
                );
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update signal status',
                });
            }
        }
    );

    fastify.get(
        '/overview',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await signalLayerService.getOverview(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(500).send({
                    success: false,
                    error: 'Failed to fetch signals overview',
                });
            }
        }
    );

    fastify.get(
        '/leads/:leadId/recommendation',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = leadRecommendationParamsSchema.parse(request.params);
                const data = await signalLayerService.getLeadRecommendation(
                    organizationId,
                    params.leadId
                );
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to fetch lead recommendation',
                });
            }
        }
    );

    fastify.post(
        '/leads/recommendations',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const body = leadRecommendationsBodySchema.parse(request.body ?? {});
                const data = await signalLayerService.getLeadRecommendations(
                    organizationId,
                    body.leadIds
                );
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to fetch lead recommendations',
                });
            }
        }
    );

    fastify.get(
        '/campaigns/:campaignId/recommendation',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = campaignRecommendationParamsSchema.parse(request.params);
                const data = await signalLayerService.getCampaignRecommendation(
                    organizationId,
                    params.campaignId
                );
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to fetch campaign recommendation',
                });
            }
        }
    );

    fastify.get(
        '/actionable-alerts',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = actionableAlertsQuerySchema.parse(request.query ?? {});
                const data = await signalLayerService.getActionableAlerts(organizationId);
                return reply.send({
                    success: true,
                    data: data.slice(0, query.limit),
                });
            } catch (error) {
                request.log.error(error);
                return reply.code(500).send({
                    success: false,
                    error: 'Failed to fetch actionable alerts',
                });
            }
        }
    );

    fastify.get(
        '/impact',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await signalLayerService.getImpact(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(500).send({
                    success: false,
                    error: 'Failed to fetch impact',
                });
            }
        }
    );

    fastify.get(
        '/cohort-status',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await signalLayerService.getCohortStatus(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(500).send({
                    success: false,
                    error: 'Failed to fetch cohort status',
                });
            }
        }
    );

    fastify.post(
        '/backfill',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const body = backfillBodySchema.parse(request.body ?? {});
                const data = await signalLayerService.backfillSignals(organizationId, body.limit);
                return reply.code(202).send({ success: true, data });
            } catch (error) {
                request.log.error(error);
                return reply.code(500).send({
                    success: false,
                    error: 'Failed to run signals backfill',
                });
            }
        }
    );
}

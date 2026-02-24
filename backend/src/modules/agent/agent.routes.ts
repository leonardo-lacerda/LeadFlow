import { AgentMode } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { assertAdminOrOwner } from '../../lib/rbac.js';
import { agentService } from './agent.service.js';

const listRunsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

const listHandoffsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['OPEN', 'RESOLVED']).optional(),
});

const summaryQuerySchema = z.object({
    lookbackDays: z.coerce.number().int().positive().max(180).default(30),
});

const conversationsQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(50).default(12),
});

const optimizationQuerySchema = z.object({
    lookbackDays: z.coerce.number().int().positive().max(180).default(30),
});

const runIdParamsSchema = z.object({
    runId: z.string().min(1),
});

const messageIdParamsSchema = z.object({
    messageId: z.string().min(1),
});

const handoffIdParamsSchema = z.object({
    handoffId: z.string().min(1),
});

const decisionIdParamsSchema = z.object({
    decisionId: z.string().min(1),
});

const updateConfigSchema = z.object({
    mode: z.nativeEnum(AgentMode).optional(),
    northStarMonthlyMeetings: z.coerce.number().int().positive().max(10000).optional(),
    guardrails: z.record(z.any()).optional(),
});

const createRunSchema = z.object({
    mode: z.nativeEnum(AgentMode).optional(),
    trigger: z.string().min(1).max(120).optional(),
    context: z.record(z.any()).optional(),
});

const approveDecisionSchema = z.object({
    execute: z.boolean().default(true),
    actionPayload: z.record(z.any()).optional(),
});

const resolveHandoffSchema = z.object({
    notes: z.string().max(1000).optional(),
});

const feedbackSchema = z.object({
    reviewedIntent: z.enum(['CURIOUS', 'FIT', 'NOT_FIT', 'DEMO', 'OBJECTION']).optional(),
    reviewedObjectionType: z.string().max(60).optional(),
    outcome: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).optional(),
    notes: z.string().max(500).optional(),
});

async function getAuthContext(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
    return {
        userId: decoded.userId,
        organizationId: decoded.organizationId,
    };
}

export async function agentRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/policy',
        { onRequest: [fastify.authenticate] },
        async (_request: FastifyRequest, reply: FastifyReply) => {
            try {
                const data = await agentService.getPolicySummary();
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load agent policy',
                });
            }
        }
    );

    fastify.get(
        '/catalog',
        { onRequest: [fastify.authenticate] },
        async (_request: FastifyRequest, reply: FastifyReply) => {
            try {
                const data = await agentService.getModesCatalog();
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load agent catalog',
                });
            }
        }
    );

    fastify.get(
        '/summary',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { organizationId } = await getAuthContext(request);
                const query = summaryQuerySchema.parse(request.query ?? {});
                const data = await agentService.getSummary(organizationId, query);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load agent summary',
                });
            }
        }
    );

    fastify.get(
        '/conversations',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { organizationId } = await getAuthContext(request);
                const query = conversationsQuerySchema.parse(request.query ?? {});
                const data = await agentService.listConversationInsights(organizationId, query);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to load conversation insights',
                });
            }
        }
    );

    fastify.post(
        '/conversations/:messageId/feedback',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                const params = messageIdParamsSchema.parse(request.params ?? {});
                const body = feedbackSchema.parse(request.body ?? {});
                const data = await agentService.recordConversationFeedback(
                    organizationId,
                    params.messageId,
                    userId,
                    body
                );
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to register conversation feedback',
                });
            }
        }
    );

    fastify.get(
        '/optimization',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { organizationId } = await getAuthContext(request);
                const query = optimizationQuerySchema.parse(request.query ?? {});
                const data = await agentService.getOptimizationDashboard(organizationId, query);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to load optimization dashboard',
                });
            }
        }
    );

    fastify.get(
        '/config',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { organizationId } = await getAuthContext(request);
                const data = await agentService.getConfig(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load agent config',
                });
            }
        }
    );

    fastify.put(
        '/config',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                await assertAdminOrOwner(userId, organizationId);
                const body = updateConfigSchema.parse(request.body ?? {});
                const data = await agentService.updateConfig(organizationId, userId, body);
                return reply.send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Forbidden' ? 403 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update agent config',
                });
            }
        }
    );

    fastify.post(
        '/runs/dry-run',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                const body = createRunSchema.parse(request.body ?? {});
                const data = await agentService.createRun(organizationId, userId, {
                    ...body,
                    dryRun: true,
                });
                return reply.code(201).send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to run agent dry-run',
                });
            }
        }
    );

    fastify.post(
        '/runs/auto-cycle',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                await assertAdminOrOwner(userId, organizationId);
                const data = await agentService.runAutoCycle(organizationId, {
                    trigger: 'manual_auto_cycle',
                    initiatedByUserId: userId,
                    enforceAutomationQuota: true,
                });
                return reply.send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Forbidden' ? 403 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to execute auto cycle',
                });
            }
        }
    );

    fastify.post(
        '/runs',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                await assertAdminOrOwner(userId, organizationId);
                const body = createRunSchema.parse(request.body ?? {});
                const data = await agentService.createRun(organizationId, userId, {
                    ...body,
                    dryRun: false,
                });
                return reply.code(201).send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Forbidden' ? 403 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create agent run',
                });
            }
        }
    );

    fastify.get(
        '/handoffs',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { organizationId } = await getAuthContext(request);
                const query = listHandoffsQuerySchema.parse(request.query ?? {});
                const data = await agentService.listHandoffs(organizationId, query);
                return reply.send({ success: true, data: data.items, meta: data.meta });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list handoffs',
                });
            }
        }
    );

    fastify.patch(
        '/handoffs/:handoffId/resolve',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                await assertAdminOrOwner(userId, organizationId);
                const params = handoffIdParamsSchema.parse(request.params ?? {});
                const body = resolveHandoffSchema.parse(request.body ?? {});
                const data = await agentService.resolveHandoff(
                    organizationId,
                    params.handoffId,
                    body.notes
                );
                return reply.send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Forbidden' ? 403 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to resolve handoff',
                });
            }
        }
    );

    fastify.get(
        '/runs',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { organizationId } = await getAuthContext(request);
                const query = listRunsQuerySchema.parse(request.query ?? {});
                const data = await agentService.listRuns(organizationId, query);
                return reply.send({ success: true, data: data.items, meta: data.meta });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list agent runs',
                });
            }
        }
    );

    fastify.get(
        '/runs/:runId',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { organizationId } = await getAuthContext(request);
                const params = runIdParamsSchema.parse(request.params ?? {});
                const data = await agentService.getRunById(organizationId, params.runId);
                return reply.send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Agent run not found' ? 404 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load agent run',
                });
            }
        }
    );

    fastify.post(
        '/runs/:runId/execute-approved',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                await assertAdminOrOwner(userId, organizationId);
                const params = runIdParamsSchema.parse(request.params ?? {});
                const data = await agentService.executeApprovedDecisions(
                    organizationId,
                    params.runId
                );
                return reply.send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Forbidden' ? 403 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to execute approved decisions',
                });
            }
        }
    );

    fastify.post(
        '/decisions/:decisionId/approve',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                await assertAdminOrOwner(userId, organizationId);
                const params = decisionIdParamsSchema.parse(request.params ?? {});
                const body = approveDecisionSchema.parse(request.body ?? {});
                const data = await agentService.approveDecision(
                    organizationId,
                    params.decisionId,
                    userId,
                    body.execute,
                    body.actionPayload
                );
                return reply.send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Forbidden' ? 403 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to approve decision',
                });
            }
        }
    );

    fastify.post(
        '/decisions/:decisionId/reject',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const { userId, organizationId } = await getAuthContext(request);
                await assertAdminOrOwner(userId, organizationId);
                const params = decisionIdParamsSchema.parse(request.params ?? {});
                const data = await agentService.rejectDecision(
                    organizationId,
                    params.decisionId,
                    userId
                );
                return reply.send({ success: true, data });
            } catch (error) {
                const statusCode =
                    error instanceof Error && error.message === 'Forbidden' ? 403 : 400;
                return reply.code(statusCode).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to reject decision',
                });
            }
        }
    );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { campaignsService } from './campaigns.service.js';
import { z } from 'zod';
import { sendLimitAwareError } from '../billing/http.js';

const createCampaignStepSchema = z.object({
    type: z.enum(['EMAIL', 'WHATSAPP', 'WAIT', 'CONDITION']),
    subject: z.string().optional(),
    content: z.string(),
    delayHours: z.number().int().default(0),
    delayDays: z.number().int().default(0),
    templateId: z.string().optional(),
});

const createCampaignSchema = z.object({
    name: z.string().min(1, 'Campaign name is required'),
    type: z.enum(['EMAIL', 'WHATSAPP', 'MULTI_CHANNEL']),
    leadIds: z.array(z.string()).min(1, 'At least one lead is required'),
    steps: z.array(createCampaignStepSchema).min(1, 'At least one step is required'),
    settings: z.record(z.any()).optional(),
    schedule: z.record(z.any()).optional(),
});

const listCampaignsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
});

const updateCampaignStatusSchema = z.object({
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
});

const addLeadsSchema = z.object({
    leadIds: z.array(z.string().min(1)).min(1),
});

const addStepSchema = createCampaignStepSchema;

const listCampaignLeadsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
});

export async function campaignsRoutes(fastify: FastifyInstance) {
    // Create campaign
    fastify.post(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = createCampaignSchema.parse(request.body);

                const campaign = await campaignsService.create(decoded.organizationId, body);

                return reply.code(201).send({
                    success: true,
                    data: campaign,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create campaign',
                });
            }
        }
    );

    // List campaigns
    fastify.get(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listCampaignsQuerySchema.parse(request.query);

                const result = await campaignsService.list(decoded.organizationId, query);

                return reply.send({
                    success: true,
                    data: result.campaigns,
                    meta: {
                        page: query.page,
                        limit: query.limit,
                        total: result.total,
                        totalPages: Math.ceil(result.total / query.limit),
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list campaigns',
                });
            }
        }
    );

    // Get campaign by ID
    fastify.get(
        '/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const campaign = await campaignsService.getById(decoded.organizationId, (request.params as { id: string }).id);

                if (!campaign) {
                    return reply.code(404).send({
                        success: false,
                        error: 'Campaign not found',
                    });
                }

                return reply.send({
                    success: true,
                    data: campaign,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get campaign',
                });
            }
        }
    );

    // List campaign leads
    fastify.get(
        '/:id/leads',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listCampaignLeadsSchema.parse(request.query);
                const result = await campaignsService.getCampaignLeads(
                    decoded.organizationId,
                    (request.params as { id: string }).id,
                    query
                );
                return reply.send({
                    success: true,
                    data: result.leads,
                    meta: {
                        page: query.page,
                        limit: query.limit,
                        total: result.total,
                        totalPages: Math.ceil(result.total / query.limit),
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list campaign leads',
                });
            }
        }
    );

    // Update campaign status
    fastify.patch(
        '/:id/status',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = updateCampaignStatusSchema.parse(request.body);

                const campaign = await campaignsService.updateStatus(
                    decoded.organizationId,
                    (request.params as { id: string }).id,
                    body.status
                );

                return reply.send({
                    success: true,
                    data: campaign,
                });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Failed to update campaign status');
            }
        }
    );

    fastify.post(
        '/:id/launch',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await campaignsService.launch(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Failed to launch campaign');
            }
        }
    );

    fastify.post(
        '/:id/pause',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await campaignsService.pause(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to pause campaign',
                });
            }
        }
    );

    fastify.post(
        '/:id/resume',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await campaignsService.resume(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Failed to resume campaign');
            }
        }
    );

    fastify.post(
        '/:id/leads',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = addLeadsSchema.parse(request.body);
                const result = await campaignsService.addLeads(
                    decoded.organizationId,
                    (request.params as { id: string }).id,
                    body
                );
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to add leads',
                });
            }
        }
    );

    fastify.post(
        '/:id/steps',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = addStepSchema.parse(request.body);
                const result = await campaignsService.addStep(
                    decoded.organizationId,
                    (request.params as { id: string }).id,
                    body
                );
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to add step',
                });
            }
        }
    );

    fastify.get(
        '/:id/analytics',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const result = await campaignsService.analytics(
                    decoded.organizationId,
                    (request.params as { id: string }).id
                );
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch analytics',
                });
            }
        }
    );

    // Delete campaign
    fastify.delete(
        '/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await campaignsService.delete(decoded.organizationId, (request.params as { id: string }).id);

                return reply.send({
                    success: true,
                    message: 'Campaign deleted successfully',
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete campaign',
                });
            }
        }
    );
}

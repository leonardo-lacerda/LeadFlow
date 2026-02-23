import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { enrichmentService } from './enrichment.service.js';
import { env } from '../../config/env.js';
import { assertTrustedWebhookUrl } from '../../lib/webhook-url.js';
import { sendLimitAwareError } from '../billing/http.js';

const createJobSchema = z.object({
    name: z.string().min(1).optional(),
    leadIds: z.array(z.string().min(1)).min(1),
    webhookUrl: z.string().url().optional(),
});

const listJobsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

const webhookSchema = z.object({
    jobId: z.string().optional(),
    job_id: z.string().optional(),
    status: z.string().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    totalItems: z.number().int().optional(),
    processedItems: z.number().int().optional(),
    leads: z.array(z.record(z.any())).optional(),
    error: z.any().optional(),
});

export async function enrichmentRoutes(fastify: FastifyInstance) {
    fastify.post(
        '/jobs',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = createJobSchema.parse(request.body);
                if (body.webhookUrl) {
                    assertTrustedWebhookUrl(body.webhookUrl);
                }

                const job = await enrichmentService.createJob(decoded.organizationId, {
                    name: body.name,
                    leadIds: body.leadIds,
                    webhookUrl: body.webhookUrl,
                });

                return reply.code(201).send({ success: true, data: job });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Failed to create enrichment job');
            }
        }
    );

    fastify.get(
        '/jobs',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listJobsQuerySchema.parse(request.query);
                const result = await enrichmentService.listJobs(decoded.organizationId, query);

                return reply.send({
                    success: true,
                    data: result.jobs,
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
                    error: error instanceof Error ? error.message : 'Failed to list enrichment jobs',
                });
            }
        }
    );

    fastify.get(
        '/jobs/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const job = await enrichmentService.getJob(decoded.organizationId, (request.params as { id: string }).id);

                if (!job) {
                    return reply.code(404).send({
                        success: false,
                        error: 'Enrichment job not found',
                    });
                }

                return reply.send({ success: true, data: job });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get enrichment job',
                });
            }
        }
    );

    fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            if (env.ENRICHMENT_WEBHOOK_SECRET) {
                const provided = request.headers['x-enrichment-secret'];
                const providedValue = Array.isArray(provided) ? provided[0] : provided;
                if (providedValue !== env.ENRICHMENT_WEBHOOK_SECRET) {
                    return reply.code(401).send({
                        success: false,
                        error: 'Unauthorized',
                    });
                }
            }

            const body = webhookSchema.parse(request.body);
            const jobId = body.jobId || body.job_id;
            if (!jobId) {
                return reply.code(400).send({
                    success: false,
                    error: 'jobId is required',
                });
            }

            const result = await enrichmentService.handleWebhook({
                jobId,
                status: body.status,
                progress: body.progress,
                totalItems: body.totalItems,
                processedItems: body.processedItems,
                leads: body.leads,
                error: body.error,
            });

            return reply.send({ success: true, data: result });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process webhook',
            });
        }
    });
}

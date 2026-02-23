import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { scrapingService, ScrapingSource } from './scraping.service.js';
import { env } from '../../config/env.js';
import { assertTrustedWebhookUrl } from '../../lib/webhook-url.js';
import { sendLimitAwareError } from '../billing/http.js';

const createJobSchema = z.object({
    name: z.string().min(1).optional(),
    source: z.enum([
        'google_maps',
        'cnpj',
        'reclame_aqui',
        'indeed',
        'catho',
        'mercado_livre',
        'wappalyzer',
        'linkedin_dork',
        'comprasnet',
    ]),
    query: z.record(z.any()),
    webhookUrl: z.string().url().optional(),
    schedule: z.string().optional(),
});

const listJobsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

const listJobLeadsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
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
    debug: z.record(z.any()).optional(),
});

export async function scrapingRoutes(fastify: FastifyInstance) {
    // Create scraping job
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

                const job = await scrapingService.createJob(decoded.organizationId, {
                    name: body.name,
                    source: body.source as ScrapingSource,
                    query: body.query,
                    webhookUrl: body.webhookUrl,
                    schedule: body.schedule,
                });

                return reply.code(201).send({
                    success: true,
                    data: job,
                });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Failed to create scraping job');
            }
        }
    );

    // Re-run scraping job
    fastify.post(
        '/jobs/:id/run',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await scrapingService.rerunJob(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Failed to re-run scraping job');
            }
        }
    );

    // Cancel scraping job
    fastify.post(
        '/jobs/:id/cancel',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await scrapingService.cancelJob(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to cancel scraping job',
                });
            }
        }
    );

    // List scraping jobs
    fastify.get(
        '/jobs',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listJobsQuerySchema.parse(request.query);

                const result = await scrapingService.listJobs(decoded.organizationId, query);

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
                    error: error instanceof Error ? error.message : 'Failed to list scraping jobs',
                });
            }
        }
    );

    // Get scraping job
    fastify.get(
        '/jobs/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const job = await scrapingService.getJob(decoded.organizationId, (request.params as { id: string }).id);

                if (!job) {
                    return reply.code(404).send({
                        success: false,
                        error: 'Scraping job not found',
                    });
                }

                return reply.send({
                    success: true,
                    data: job,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get scraping job',
                });
            }
        }
    );

    // List leads for a scraping job
    fastify.get(
        '/jobs/:id/leads',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { id: string };
                const query = listJobLeadsQuerySchema.parse(request.query);

                const result = await scrapingService.listJobLeads(decoded.organizationId, params.id, query);

                return reply.send({
                    success: true,
                    data: result.leads,
                    meta: {
                        page: query.page,
                        limit: query.limit,
                        total: result.total,
                        totalPages: Math.ceil(result.total / query.limit),
                        statusSummary: result.statusSummary,
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list job leads',
                });
            }
        }
    );

    // Webhook callback from scraping service
    fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            if (env.SCRAPING_WEBHOOK_SECRET) {
                const provided = request.headers['x-scraping-secret'];
                const providedValue = Array.isArray(provided) ? provided[0] : provided;
                if (providedValue !== env.SCRAPING_WEBHOOK_SECRET) {
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

            const result = await scrapingService.handleWebhook({
                jobId,
                status: body.status,
                progress: body.progress,
                totalItems: body.totalItems,
                processedItems: body.processedItems,
                leads: body.leads,
                error: body.error,
                debug: body.debug,
            });

            return reply.send({
                success: true,
                data: result,
            });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process webhook',
            });
        }
    });
}

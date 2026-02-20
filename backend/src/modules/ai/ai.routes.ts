import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { aiService } from './ai.service.js';
import { env } from '../../config/env.js';
import { fetchWithTimeout } from '../../lib/fetch.js';
import { prisma } from '../../lib/prisma.js';

const createScoringJobSchema = z.object({
    name: z.string().min(1).optional(),
    leadIds: z.array(z.string().min(1)).min(1),
    icp: z.record(z.any()).optional(),
    promptId: z.string().optional(),
    providerOrder: z.array(z.string().min(1)).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
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
    results: z.array(z.record(z.any())).optional(),
    error: z.any().optional(),
});

const generateSchema = z.object({
    type: z.enum(['email', 'whatsapp']).optional(),
    lead: z.record(z.any()),
    company: z.record(z.any()).optional(),
    tone: z.string().optional(),
    language: z.string().optional(),
    variants: z.number().int().min(1).max(5).optional(),
    promptId: z.string().optional(),
    variables: z.record(z.any()).optional(),
    providerOrder: z.array(z.string()).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
});

const analyzeSchema = z.object({
    message: z.string().min(1),
    tone: z.string().optional(),
    language: z.string().optional(),
    promptId: z.string().optional(),
    variables: z.record(z.any()).optional(),
    providerOrder: z.array(z.string()).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
});

const scoreSchema = z.object({
    leadId: z.string().min(1),
    icp: z.record(z.any()).optional(),
    promptId: z.string().optional(),
    providerOrder: z.array(z.string()).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
    apply: z.boolean().optional(),
});

const promptCreateSchema = z.object({
    name: z.string().min(1),
    content: z.string().min(1),
    variables: z.array(z.string()).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
});

const promptUpdateSchema = promptCreateSchema.partial();

const icpSchema = z.object({
    icp: z.record(z.any()),
});

async function callAi(
    path: string,
    body?: Record<string, unknown>,
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
) {
    const resolvedMethod = method ?? (body ? 'POST' : 'GET');
    const response = await fetchWithTimeout(`${env.AI_SERVICE_URL}${path}`, {
        method: resolvedMethod,
        headers: {
            'content-type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI service error (${response.status}): ${text}`);
    }

    return response.json();
}

export async function aiRoutes(fastify: FastifyInstance) {
    fastify.post(
        '/scoring/jobs',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = createScoringJobSchema.parse(request.body);
                const job = await aiService.createScoringJob(decoded.organizationId, body);
                return reply.code(201).send({ success: true, data: job });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create scoring job',
                });
            }
        }
    );

    fastify.post(
        '/score',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = scoreSchema.parse(request.body);
                const lead = await prisma.lead.findFirst({
                    where: { id: body.leadId, organizationId: decoded.organizationId },
                });
                if (!lead) {
                    return reply.code(404).send({ success: false, error: 'Lead not found' });
                }
                const organization = await prisma.organization.findUnique({
                    where: { id: decoded.organizationId },
                    select: { icpDefinition: true },
                });
                const icp = body.icp ?? (organization?.icpDefinition as Record<string, unknown> | null) ?? undefined;

                const payload = {
                    lead,
                    icp,
                    prompt_id: body.promptId,
                    provider_order: body.providerOrder,
                    temperature: body.temperature,
                    max_tokens: body.maxTokens,
                    org_id: decoded.organizationId,
                };
                const result = (await callAi('/score', payload as Record<string, unknown>)) as Record<
                    string,
                    unknown
                >;
                const payloadData = (result?.['data'] ?? result) as Record<string, unknown>;
                const rawScore =
                    payloadData['score'] ??
                    (payloadData['data'] as Record<string, unknown>)?.['score'];
                const rawIcpMatch =
                    payloadData['icp_match'] ??
                    payloadData['icpMatch'] ??
                    (payloadData['data'] as Record<string, unknown>)?.['icp_match'];
                const tags =
                    payloadData['tags'] ??
                    (payloadData['data'] as Record<string, unknown>)?.['tags'];

                const score = typeof rawScore === 'number' ? rawScore : undefined;
                const icpMatch = typeof rawIcpMatch === 'number' ? rawIcpMatch : undefined;

                if (body.apply !== false && score !== undefined) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            score,
                            icpMatch: icpMatch ?? undefined,
                            tags: Array.isArray(tags) ? (tags as string[]) : undefined,
                        },
                    });
                }

                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to score lead',
                });
            }
        }
    );

    fastify.get(
        '/scoring/jobs',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listJobsQuerySchema.parse(request.query);
                const result = await aiService.listJobs(decoded.organizationId, query);
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
                    error: error instanceof Error ? error.message : 'Failed to list jobs',
                });
            }
        }
    );

    fastify.get(
        '/scoring/jobs/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { id: string };
                const job = await aiService.getJob(decoded.organizationId, params.id);
                if (!job) {
                    return reply.code(404).send({ success: false, error: 'Job not found' });
                }
                return reply.send({ success: true, data: job });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get job',
                });
            }
        }
    );

    fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            if (env.AI_WEBHOOK_SECRET) {
                const provided = request.headers['x-ai-secret'];
                const providedValue = Array.isArray(provided) ? provided[0] : provided;
                if (providedValue !== env.AI_WEBHOOK_SECRET) {
                    return reply.code(401).send({ success: false, error: 'Unauthorized' });
                }
            }

            const body = webhookSchema.parse(request.body);
            const jobId = body.jobId || body.job_id;
            if (!jobId) {
                return reply.code(400).send({ success: false, error: 'jobId is required' });
            }

            const result = await aiService.handleWebhook({
                jobId,
                status: body.status,
                progress: body.progress,
                totalItems: body.totalItems,
                processedItems: body.processedItems,
                results: body.results,
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

    fastify.post(
        '/generate',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = generateSchema.parse(request.body);
                if (!body.type) {
                    return reply
                        .code(400)
                        .send({ success: false, error: 'type is required' });
                }
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/generate', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to generate message',
                });
            }
        }
    );

    fastify.post(
        '/generate/email',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = generateSchema.parse(request.body);
                const payload = { ...body, type: 'email', org_id: decoded.organizationId };
                const result = await callAi('/generate/email', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to generate email',
                });
            }
        }
    );

    fastify.post(
        '/generate/whatsapp',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = generateSchema.parse(request.body);
                const payload = { ...body, type: 'whatsapp', org_id: decoded.organizationId };
                const result = await callAi('/generate/whatsapp', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to generate WhatsApp',
                });
            }
        }
    );

    fastify.post(
        '/analyze/intent',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/analyze/intent', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to analyze intent',
                });
            }
        }
    );

    fastify.post(
        '/analyze/sentiment',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/analyze/sentiment', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to analyze sentiment',
                });
            }
        }
    );

    fastify.post(
        '/analyze/categorize',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/analyze/categorize', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to categorize',
                });
            }
        }
    );

    fastify.post(
        '/analyze/suggest',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/analyze/suggest', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to suggest response',
                });
            }
        }
    );

    fastify.post(
        '/analyze/meeting',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/analyze/meeting', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to detect meeting',
                });
            }
        }
    );

    fastify.post(
        '/predict/best-time',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/predict/best-time', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to predict best time',
                });
            }
        }
    );

    fastify.post(
        '/optimize/subject',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/optimize/subject', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to optimize subject',
                });
            }
        }
    );

    fastify.post(
        '/optimize/length',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/optimize/length', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to optimize length',
                });
            }
        }
    );

    fastify.post(
        '/predict/engagement',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = analyzeSchema.parse(request.body);
                const payload = { ...body, org_id: decoded.organizationId };
                const result = await callAi('/predict/engagement', payload as Record<string, unknown>);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to predict engagement',
                });
            }
        }
    );

    fastify.get(
        '/usage',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const result = await callAi(`/usage?org_id=${decoded.organizationId}`);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch usage',
                });
            }
        }
    );

    fastify.get(
        '/prompts',
        { onRequest: [fastify.authenticate] },
        async (_request: FastifyRequest, reply: FastifyReply) => {
            try {
                const result = await callAi('/prompts');
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list prompts',
                });
            }
        }
    );

    fastify.get(
        '/prompts/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const params = request.params as { id: string };
                const result = await callAi(`/prompts/${params.id}`);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get prompt',
                });
            }
        }
    );

    fastify.post(
        '/prompts',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const body = promptCreateSchema.parse(request.body);
                const result = await callAi('/prompts', body as Record<string, unknown>, 'POST');
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create prompt',
                });
            }
        }
    );

    fastify.put(
        '/prompts/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const body = promptUpdateSchema.parse(request.body);
                const params = request.params as { id: string };
                const result = await callAi(
                    `/prompts/${params.id}`,
                    body as Record<string, unknown>,
                    'PUT'
                );
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update prompt',
                });
            }
        }
    );

    fastify.delete(
        '/prompts/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const params = request.params as { id: string };
                const result = await callAi(`/prompts/${params.id}`, undefined, 'DELETE');
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete prompt',
                });
            }
        }
    );

    fastify.get(
        '/icp',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const organization = await prisma.organization.findUnique({
                    where: { id: decoded.organizationId },
                    select: { icpDefinition: true },
                });
                return reply.send({ success: true, data: organization?.icpDefinition || {} });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch ICP',
                });
            }
        }
    );

    fastify.put(
        '/icp',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = icpSchema.parse(request.body);
                const organization = await prisma.organization.update({
                    where: { id: decoded.organizationId },
                    data: { icpDefinition: body.icp },
                    select: { icpDefinition: true },
                });
                return reply.send({ success: true, data: organization.icpDefinition || {} });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update ICP',
                });
            }
        }
    );
}

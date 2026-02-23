import { JobStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { aiQueue } from '../../lib/queue.js';
import { billingService } from '../billing/billing.service.js';

interface CreateAiJobInput {
    name?: string;
    leadIds: string[];
    icp?: Record<string, unknown>;
    promptId?: string;
    providerOrder?: string[];
    temperature?: number;
    maxTokens?: number;
    webhookUrl?: string;
}

interface ListJobsQuery {
    page: number;
    limit: number;
}

interface AiWebhookPayload {
    jobId: string;
    status?: string;
    progress?: number;
    totalItems?: number;
    processedItems?: number;
    results?: Array<Record<string, unknown>>;
    error?: unknown;
}

function normalizeStatus(status?: string): JobStatus {
    const value = (status || '').toUpperCase();
    if (['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(value)) {
        return value as JobStatus;
    }
    if (value === 'SUCCESS') {
        return 'COMPLETED';
    }
    return 'COMPLETED';
}

export class AiService {
    async createScoringJob(organizationId: string, input: CreateAiJobInput) {
        await billingService.assertConcurrentJobsLimit(organizationId, 1);

        const leads = await prisma.lead.findMany({
            where: { id: { in: input.leadIds }, organizationId },
            select: { id: true },
        });

        if (leads.length === 0) {
            throw new Error('No leads found for scoring');
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { icpDefinition: true },
        });

        const icp =
            input.icp ??
            (organization?.icpDefinition as Prisma.JsonObject | null) ??
            undefined;

        const job = await prisma.aiJob.create({
            data: {
                name: input.name || 'AI scoring job',
                type: 'SCORING',
                query: {
                    leadIds: leads.map((lead) => lead.id),
                    icp: icp || null,
                    promptId: input.promptId || null,
                } as Prisma.InputJsonValue,
                status: 'PENDING',
                totalItems: leads.length,
                organizationId,
            },
        });

        await aiQueue.add('score', {
            jobId: job.id,
            organizationId,
            leadIds: leads.map((lead) => lead.id),
            icp,
            promptId: input.promptId,
            providerOrder: input.providerOrder,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            webhookUrl: input.webhookUrl,
        });

        return job;
    }

    async listJobs(organizationId: string, query: ListJobsQuery) {
        const skip = (query.page - 1) * query.limit;
        const [jobs, total] = await Promise.all([
            prisma.aiJob.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: query.limit,
            }),
            prisma.aiJob.count({ where: { organizationId } }),
        ]);
        return { jobs, total };
    }

    async getJob(organizationId: string, jobId: string) {
        return prisma.aiJob.findFirst({
            where: { id: jobId, organizationId },
        });
    }

    async handleWebhook(payload: AiWebhookPayload) {
        const job = await prisma.aiJob.findUnique({
            where: { id: payload.jobId },
        });

        if (!job) {
            return null;
        }

        const resultsPayload = payload.results || [];
        let updatedCount = 0;

        for (const result of resultsPayload) {
            const leadId =
                (result['leadId'] as string) ||
                (result['lead_id'] as string) ||
                (result['id'] as string);
            if (!leadId) {
                continue;
            }

            const updateData: Prisma.LeadUpdateInput = {
                score: typeof result['score'] === 'number' ? (result['score'] as number) : undefined,
                icpMatch:
                    typeof result['icp_match'] === 'number'
                        ? (result['icp_match'] as number)
                        : typeof result['icpMatch'] === 'number'
                        ? (result['icpMatch'] as number)
                        : undefined,
            };

            if (Array.isArray(result['tags'])) {
                updateData.tags = result['tags'] as string[];
            }

            await prisma.lead.updateMany({
                where: { id: leadId, organizationId: job.organizationId },
                data: updateData,
            });
            updatedCount += 1;
        }

        const status = payload.status ? normalizeStatus(payload.status) : job.status;
        const totalItems = payload.totalItems ?? (job.totalItems || updatedCount);
        const processedItems = payload.processedItems ?? job.processedItems + updatedCount;

        await prisma.aiJob.update({
            where: { id: job.id },
            data: {
                status,
                progress: payload.progress ?? (status === 'COMPLETED' ? 100 : job.progress),
                totalItems,
                processedItems,
                results: payload.results
                    ? (payload.results as Prisma.InputJsonValue)
                    : (job.results ?? undefined),
                errors: payload.error
                    ? ({ error: payload.error } as Prisma.InputJsonValue)
                    : (job.errors ?? undefined),
            },
        });

        return { updatedCount };
    }
}

export const aiService = new AiService();

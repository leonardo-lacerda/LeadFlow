import { JobStatus, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { scrapingQueue } from '../../lib/queue.js';

export type ScrapingSource =
    | 'google_maps'
    | 'cnpj'
    | 'reclame_aqui'
    | 'indeed'
    | 'catho'
    | 'mercado_livre'
    | 'wappalyzer'
    | 'linkedin_dork'
    | 'comprasnet';

interface CreateScrapingJobInput {
    name?: string;
    source: ScrapingSource;
    query: Record<string, unknown>;
    webhookUrl?: string;
    schedule?: string;
}

interface ListJobsQuery {
    page: number;
    limit: number;
}

interface ListJobLeadsQuery {
    page: number;
    limit: number;
    search?: string;
}

interface ScrapingWebhookPayload {
    jobId: string;
    status?: string;
    progress?: number;
    totalItems?: number;
    processedItems?: number;
    leads?: Array<Record<string, unknown>>;
    error?: unknown;
    debug?: Record<string, unknown>;
}

const LEAD_FIELDS = new Set([
    'firstName',
    'lastName',
    'fullName',
    'email',
    'phone',
    'whatsapp',
    'linkedinUrl',
    'companyName',
    'companyDomain',
    'companyCnpj',
    'companySize',
    'industry',
    'jobTitle',
    'seniority',
    'department',
    'city',
    'state',
    'country',
    'source',
    'sourceUrl',
    'enrichmentData',
    'tags',
]);

function pickValue(lead: Record<string, unknown>, camel: string, snake: string) {
    return (lead[camel] ?? lead[snake]) as unknown;
}

function normalizeLead(lead: Record<string, unknown>, source: string) {
    const firstName = pickValue(lead, 'firstName', 'first_name') as string | undefined;
    const lastName = pickValue(lead, 'lastName', 'last_name') as string | undefined;
    const fullName = pickValue(lead, 'fullName', 'full_name') as string | undefined;

    const normalized: Record<string, unknown> = {
        firstName,
        lastName,
        fullName,
        email: pickValue(lead, 'email', 'email'),
        phone: pickValue(lead, 'phone', 'phone'),
        whatsapp: pickValue(lead, 'whatsapp', 'whatsapp'),
        linkedinUrl: pickValue(lead, 'linkedinUrl', 'linkedin_url'),
        companyName: pickValue(lead, 'companyName', 'company_name'),
        companyDomain: pickValue(lead, 'companyDomain', 'company_domain'),
        companyCnpj: pickValue(lead, 'companyCnpj', 'company_cnpj'),
        companySize: pickValue(lead, 'companySize', 'company_size'),
        industry: pickValue(lead, 'industry', 'industry'),
        jobTitle: pickValue(lead, 'jobTitle', 'job_title'),
        seniority: pickValue(lead, 'seniority', 'seniority'),
        department: pickValue(lead, 'department', 'department'),
        city: pickValue(lead, 'city', 'city'),
        state: pickValue(lead, 'state', 'state'),
        country: pickValue(lead, 'country', 'country'),
        source: pickValue(lead, 'source', 'source') || source,
        sourceUrl: pickValue(lead, 'sourceUrl', 'source_url'),
        enrichmentData: pickValue(lead, 'enrichmentData', 'enrichment_data'),
        tags: (lead['tags'] as string[]) || [],
    };

    if (!fullName && (firstName || lastName)) {
        normalized.fullName = [firstName, lastName].filter(Boolean).join(' ');
    }

    return Object.fromEntries(
        Object.entries(normalized).filter(
            ([key, value]) => LEAD_FIELDS.has(key) && value !== undefined
        )
    );
}

function normalizeFingerprintField(value: unknown) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().toLowerCase();
}

function buildLeadFingerprint(lead: Record<string, unknown>, source: string) {
    const parts = [
        source,
        normalizeFingerprintField(lead['email']),
        normalizeFingerprintField(lead['phone']),
        normalizeFingerprintField(lead['whatsapp']),
        normalizeFingerprintField(lead['linkedinUrl']),
        normalizeFingerprintField(lead['sourceUrl']),
        normalizeFingerprintField(lead['companyName']),
        normalizeFingerprintField(lead['fullName']),
    ].filter(Boolean);

    const fingerprintBase = parts.length > 0 ? parts.join('|') : JSON.stringify(lead);
    return crypto.createHash('sha256').update(fingerprintBase).digest('hex');
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

export class ScrapingService {
    async createJob(organizationId: string, input: CreateScrapingJobInput) {
        const job = await prisma.scrapingJob.create({
            data: {
                name: input.name || `${input.source} scrape`,
                source: input.source,
                query: input.query as Prisma.InputJsonValue,
                status: 'PENDING',
                schedule: input.schedule ?? null,
                organizationId,
            },
        });
        const data = {
            jobId: job.id,
            organizationId,
            source: input.source,
            query: input.query,
            webhookUrl: input.webhookUrl,
        };

        await scrapingQueue.add(
            'scrape',
            data,
            input.schedule
                ? {
                      repeat: { pattern: input.schedule },
                      jobId: `scraping:${job.id}`,
                  }
                : undefined
        );

        return job;
    }

    async listJobs(organizationId: string, query: ListJobsQuery) {
        const skip = (query.page - 1) * query.limit;

        const [jobs, total] = await Promise.all([
            prisma.scrapingJob.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: query.limit,
            }),
            prisma.scrapingJob.count({ where: { organizationId } }),
        ]);

        return { jobs, total };
    }

    async listJobLeads(organizationId: string, jobId: string, query: ListJobLeadsQuery) {
        const job = await prisma.scrapingJob.findFirst({
            where: { id: jobId, organizationId },
        });

        if (!job) {
            throw new Error('Scraping job not found');
        }

        const skip = (query.page - 1) * query.limit;
        const where: Prisma.LeadWhereInput = {
            organizationId,
            scrapingJobId: jobId,
        };

        if (query.search) {
            where.OR = [
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { companyName: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take: query.limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.lead.count({ where }),
        ]);

        return { leads, total };
    }

    async getJob(organizationId: string, jobId: string) {
        return prisma.scrapingJob.findFirst({
            where: {
                id: jobId,
                organizationId,
            },
        });
    }

    async rerunJob(organizationId: string, jobId: string) {
        const job = await prisma.scrapingJob.findFirst({
            where: { id: jobId, organizationId },
        });

        if (!job) {
            throw new Error('Scraping job not found');
        }

        await prisma.scrapingJob.update({
            where: { id: job.id },
            data: {
                status: 'PENDING',
                progress: 0,
                processedItems: 0,
                totalItems: 0,
            },
        });

        await scrapingQueue.add('scrape', {
            jobId: job.id,
            organizationId,
            source: job.source,
            query: job.query as Record<string, unknown>,
        });

        return true;
    }

    async cancelJob(organizationId: string, jobId: string) {
        const job = await prisma.scrapingJob.findFirst({
            where: { id: jobId, organizationId },
        });

        if (!job) {
            throw new Error('Scraping job not found');
        }

        if (job.schedule) {
            await scrapingQueue.removeRepeatable(
                'scrape',
                { pattern: job.schedule },
                `scraping:${job.id}`
            );
        }

        await prisma.scrapingJob.update({
            where: { id: job.id },
            data: {
                status: 'CANCELLED',
            },
        });

        return true;
    }

    async handleWebhook(payload: ScrapingWebhookPayload) {
        const job = await prisma.scrapingJob.findUnique({
            where: { id: payload.jobId },
        });

        if (!job) {
            return null;
        }

        const leadsPayload = payload.leads || [];
        const normalizedLeads = leadsPayload.map((lead) =>
            normalizeLead(lead, job.source)
        );

        const leadsToCreate = normalizedLeads.map((lead) => ({
            ...lead,
            organizationId: job.organizationId,
            scrapingJobId: job.id,
            sourceFingerprint: buildLeadFingerprint(lead, job.source),
        }));

        let createdCount = 0;
        let droppedByLimit = 0;
        if (leadsToCreate.length > 0) {
            const result = await prisma.$transaction(async (tx) => {
                const organization = await tx.organization.findUnique({
                    where: { id: job.organizationId },
                    select: { leadsLimit: true, leadsUsed: true },
                });

                if (!organization) {
                    throw new Error('Organization not found');
                }

                const remaining = Math.max(organization.leadsLimit - organization.leadsUsed, 0);
                if (remaining <= 0) {
                    return { count: 0, dropped: leadsToCreate.length };
                }

                const cappedLeads = leadsToCreate.slice(0, remaining);
                const createResult = await tx.lead.createMany({
                    data: cappedLeads,
                    skipDuplicates: true,
                });

                if (createResult.count > 0) {
                    await tx.organization.update({
                        where: { id: job.organizationId },
                        data: { leadsUsed: { increment: createResult.count } },
                    });
                }

                return {
                    count: createResult.count,
                    dropped: Math.max(leadsToCreate.length - cappedLeads.length, 0),
                };
            });
            createdCount = result.count;
            droppedByLimit = result.dropped;
        }

        const status = payload.status ? normalizeStatus(payload.status) : job.status;
        const totalItems = payload.totalItems ?? (job.totalItems || leadsToCreate.length);
        const processedItems =
            payload.processedItems ?? (job.processedItems || leadsToCreate.length);
        const leadsCreated = job.leadsCreated + createdCount;

        const diagnostics = {
            status,
            payloadLeadCount: leadsPayload.length,
            normalizedLeadCount: normalizedLeads.length,
            createdCount,
            droppedByLimit,
            totalItems,
            processedItems,
            scraperDebug: payload.debug ?? null,
            at: new Date().toISOString(),
        };

        console.info(
            `[scraping:webhook] job=${job.id} status=${status} payloadLeads=${leadsPayload.length} created=${createdCount} totalItems=${totalItems} processedItems=${processedItems}`
        );

        let errorsUpdate: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
        if (payload.error) {
            errorsUpdate = {
                error: payload.error,
                diagnostics,
            } as Prisma.InputJsonValue;
        } else if (status === 'COMPLETED' && createdCount === 0) {
            errorsUpdate = {
                warning: 'Scraping completed with no leads',
                diagnostics,
            } as Prisma.InputJsonValue;
        } else if (status === 'COMPLETED' && createdCount > 0) {
            errorsUpdate = Prisma.JsonNull;
        }

        await prisma.scrapingJob.update({
            where: { id: job.id },
            data: {
                status,
                progress: payload.progress ?? (status === 'COMPLETED' ? 100 : job.progress),
                totalItems,
                processedItems,
                leadsCreated,
                errors: errorsUpdate,
            },
        });

        return { createdCount };
    }
}

export const scrapingService = new ScrapingService();

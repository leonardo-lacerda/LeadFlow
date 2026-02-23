import { JobStatus, LeadStatus, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { scrapingQueue } from '../../lib/queue.js';
import { enrichmentService } from '../enrichment/enrichment.service.js';
import { leadPoolService } from '../lead-pool/lead-pool.service.js';
import { scoringService } from '../scoring/scoring.service.js';
import { billingService } from '../billing/billing.service.js';

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

interface LeadStatusSummary {
    total: number;
    byStatus: Record<string, number>;
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

interface PostCapturePipelineReport {
    scoring: {
        queued: boolean;
        leadCount: number;
        error: string | null;
    };
    enrichment: {
        queued: boolean;
        leadCount: number;
        skippedReason: string | null;
        error: string | null;
    };
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

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const GENERIC_BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'google.com',
    'google.com.br',
    'googleusercontent.com',
    'duckduckgo.com',
    'bing.com',
    'search.brave.com',
];

const SOURCE_BLOCKED_DOMAINS: Record<string, string[]> = {
    google_maps: ['google.com', 'google.com.br', 'maps.google.com', 'maps.google.com.br'],
    indeed: ['indeed.com', 'indeed.com.br'],
    catho: ['catho.com.br'],
    reclame_aqui: ['reclameaqui.com.br'],
    mercado_livre: ['mercadolivre.com.br', 'mercadolibre.com'],
    comprasnet: ['comprasnet.gov.br', 'gov.br'],
    linkedin_dork: ['linkedin.com'],
    cnpj: ['cnpj.biz', 'receitaws.com.br'],
};

function asCleanString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeUrl(value: unknown): string | undefined {
    const raw = asCleanString(value);
    if (!raw) {
        return undefined;
    }
    let candidate = raw;
    if (candidate.startsWith('//')) {
        candidate = `https:${candidate}`;
    } else if (!/^https?:\/\//i.test(candidate)) {
        candidate = `https://${candidate}`;
    }
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return undefined;
        }
        return parsed.toString();
    } catch {
        return undefined;
    }
}

function normalizeDomain(value: unknown): string | undefined {
    const url = normalizeUrl(value);
    if (url) {
        const host = new URL(url).hostname.toLowerCase();
        const cleanedHost = host.startsWith('www.') ? host.slice(4) : host;
        return cleanedHost || undefined;
    }
    const raw = asCleanString(value)?.toLowerCase();
    if (!raw) {
        return undefined;
    }
    const withoutProtocol = raw.replace(/^https?:\/\//i, '');
    const host = withoutProtocol.split('/', 1)[0] ?? '';
    const cleanedHost = host.startsWith('www.') ? host.slice(4) : host;
    if (!cleanedHost || !cleanedHost.includes('.') || /\s/.test(cleanedHost)) {
        return undefined;
    }
    return cleanedHost;
}

function normalizeEmail(value: unknown): string | undefined {
    const raw = asCleanString(value)?.toLowerCase().replace(/[.,;:<>]+$/g, '');
    if (!raw) {
        return undefined;
    }
    return EMAIL_REGEX.test(raw) ? raw : undefined;
}

function normalizePhone(value: unknown): string | undefined {
    const raw = asCleanString(value);
    if (!raw) {
        return undefined;
    }
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 8) {
        return undefined;
    }
    return cleaned;
}

function normalizeTags(value: unknown, source: string): string[] {
    const items = Array.isArray(value) ? value : [];
    const result: string[] = [];
    const seen = new Set<string>();

    const pushTag = (raw: unknown) => {
        const cleaned = asCleanString(raw);
        if (!cleaned) {
            return;
        }
        const key = cleaned.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        result.push(cleaned);
    };

    pushTag(source);
    for (const item of items) {
        pushTag(item);
    }

    return result.slice(0, 30);
}

function toJsonObject(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return value as Record<string, unknown>;
}

function normalizeStringArray(
    value: unknown,
    itemNormalizer: (raw: unknown) => string | undefined
): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    if (!Array.isArray(value)) {
        return result;
    }
    for (const item of value) {
        const normalized = itemNormalizer(item);
        if (!normalized) {
            continue;
        }
        const key = normalized.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(normalized);
        if (result.length >= 5) {
            break;
        }
    }
    return result;
}

function isBlockedDomainForSource(domain: string, source: string): boolean {
    const blocklist = [...GENERIC_BLOCKED_DOMAINS, ...(SOURCE_BLOCKED_DOMAINS[source] || [])];
    return blocklist.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

function normalizeEnrichmentData(
    value: unknown
): Record<string, unknown> | undefined {
    const root = toJsonObject(value);
    if (!root) {
        return undefined;
    }

    const normalized: Record<string, unknown> = { ...root };

    if ('website' in root) {
        normalized.website = normalizeUrl(root.website) ?? null;
    }

    const socials = toJsonObject(root.socials);
    if (socials) {
        const normalizedSocials: Record<string, string> = {};
        for (const [key, raw] of Object.entries(socials)) {
            const url = normalizeUrl(raw);
            if (!url) {
                continue;
            }
            normalizedSocials[key] = url;
        }
        normalized.socials = normalizedSocials;
    }

    const contacts = toJsonObject(root.contacts);
    if (contacts) {
        const emails = normalizeStringArray(contacts.emails, normalizeEmail);
        const phones = normalizeStringArray(contacts.phones, normalizePhone);
        normalized.contacts = {
            ...contacts,
            emails,
            phones,
        };
    }

    const maps = toJsonObject(root.maps);
    if (maps) {
        normalized.maps = {
            ...maps,
            url: normalizeUrl(maps.url) ?? null,
            rawUrl: normalizeUrl(maps.rawUrl) ?? null,
            osmUrl: normalizeUrl(maps.osmUrl) ?? null,
        };
    }

    return normalized;
}

function extractDomainFromEmail(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }
    const index = value.lastIndexOf('@');
    if (index === -1 || index === value.length - 1) {
        return undefined;
    }
    return normalizeDomain(value.slice(index + 1));
}

function hasLeadIdentity(lead: Record<string, unknown>): boolean {
    return Boolean(
        asCleanString(lead.fullName) ||
            asCleanString(lead.companyName) ||
            asCleanString(lead.email) ||
            asCleanString(lead.phone) ||
            asCleanString(lead.whatsapp) ||
            asCleanString(lead.linkedinUrl) ||
            asCleanString(lead.companyCnpj)
    );
}

function hasMockTag(lead: Record<string, unknown>): boolean {
    const tags = lead['tags'];
    if (!Array.isArray(tags)) {
        return false;
    }
    return tags.some(
        (item) => typeof item === 'string' && item.trim().toLowerCase() === 'mock'
    );
}

function shouldDropMockLead(lead: Record<string, unknown>): boolean {
    return (
        env.NODE_ENV === 'production' &&
        !env.ALLOW_MOCK_SCRAPING_LEADS_IN_PRODUCTION &&
        hasMockTag(lead)
    );
}

function normalizeLead(lead: Record<string, unknown>, fallbackSource: string) {
    const firstName = asCleanString(pickValue(lead, 'firstName', 'first_name'));
    const lastName = asCleanString(pickValue(lead, 'lastName', 'last_name'));
    const inputFullName = asCleanString(pickValue(lead, 'fullName', 'full_name'));
    const resolvedSource =
        asCleanString(pickValue(lead, 'source', 'source'))?.toLowerCase() || fallbackSource;

    const email = normalizeEmail(pickValue(lead, 'email', 'email'));
    const phone = normalizePhone(pickValue(lead, 'phone', 'phone'));
    const whatsapp = normalizePhone(pickValue(lead, 'whatsapp', 'whatsapp'));
    const linkedinUrl = normalizeUrl(pickValue(lead, 'linkedinUrl', 'linkedin_url'));
    const enrichmentData = normalizeEnrichmentData(
        pickValue(lead, 'enrichmentData', 'enrichment_data')
    );

    const maps = enrichmentData
        ? (toJsonObject(enrichmentData.maps) as Record<string, unknown> | undefined)
        : undefined;
    let sourceUrl = normalizeUrl(pickValue(lead, 'sourceUrl', 'source_url'));
    if (!sourceUrl && resolvedSource === 'linkedin_dork' && linkedinUrl) {
        sourceUrl = linkedinUrl;
    }
    if (!sourceUrl && maps) {
        sourceUrl =
            normalizeUrl(maps.url) ||
            normalizeUrl(maps.rawUrl) ||
            normalizeUrl(maps.osmUrl);
    }

    const companyDomainCandidates = [
        normalizeDomain(pickValue(lead, 'companyDomain', 'company_domain')),
        extractDomainFromEmail(email),
        sourceUrl ? normalizeDomain(sourceUrl) : undefined,
    ].filter((value): value is string => Boolean(value));
    const companyDomain = companyDomainCandidates.find(
        (candidate) => !isBlockedDomainForSource(candidate, resolvedSource)
    );

    const normalized: Record<string, unknown> = {
        firstName,
        lastName,
        fullName: inputFullName,
        email,
        phone,
        whatsapp,
        linkedinUrl,
        companyName: asCleanString(pickValue(lead, 'companyName', 'company_name')),
        companyDomain,
        companyCnpj: asCleanString(pickValue(lead, 'companyCnpj', 'company_cnpj')),
        companySize: asCleanString(pickValue(lead, 'companySize', 'company_size')),
        industry: asCleanString(pickValue(lead, 'industry', 'industry')),
        jobTitle: asCleanString(pickValue(lead, 'jobTitle', 'job_title')),
        seniority: asCleanString(pickValue(lead, 'seniority', 'seniority')),
        department: asCleanString(pickValue(lead, 'department', 'department')),
        city: asCleanString(pickValue(lead, 'city', 'city')),
        state: asCleanString(pickValue(lead, 'state', 'state')),
        country: asCleanString(pickValue(lead, 'country', 'country')),
        source: resolvedSource,
        sourceUrl,
        enrichmentData,
        tags: normalizeTags(lead['tags'], resolvedSource),
    };

    if (!normalized.fullName && (firstName || lastName)) {
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
    private async runPostCapturePipeline(
        organizationId: string,
        scrapingJobId: string
    ): Promise<PostCapturePipelineReport> {
        const report: PostCapturePipelineReport = {
            scoring: {
                queued: false,
                leadCount: 0,
                error: null,
            },
            enrichment: {
                queued: false,
                leadCount: 0,
                skippedReason: null,
                error: null,
            },
        };

        try {
            const unscoredLeads = await prisma.lead.findMany({
                where: {
                    organizationId,
                    scrapingJobId,
                    lastScoreUpdate: null,
                },
                select: { id: true },
            });
            const leadIds = unscoredLeads.map((lead) => lead.id);
            report.scoring.leadCount = leadIds.length;

            if (leadIds.length > 0) {
                await scoringService.enqueueRecalculation(organizationId, {
                    leadIds,
                    limit: leadIds.length,
                });
                report.scoring.queued = true;
            }
        } catch (error) {
            report.scoring.error =
                error instanceof Error ? error.message : 'Failed to enqueue scoring recalculation';
        }

        if (!env.AUTO_ENRICH_LEADS) {
            report.enrichment.skippedReason = 'AUTO_ENRICH_LEADS disabled';
            return report;
        }

        try {
            const enrichmentEligibleLeads = await prisma.lead.findMany({
                where: {
                    organizationId,
                    scrapingJobId,
                    status: LeadStatus.NEW,
                    emailVerified: false,
                },
                select: { id: true },
            });
            const leadIds = enrichmentEligibleLeads.map((lead) => lead.id);
            report.enrichment.leadCount = leadIds.length;

            if (leadIds.length === 0) {
                report.enrichment.skippedReason = 'No NEW leads eligible for enrichment';
                return report;
            }

            await enrichmentService.createJob(organizationId, {
                name: `Auto enrichment for scraping job ${scrapingJobId}`,
                leadIds,
            });
            report.enrichment.queued = true;
        } catch (error) {
            report.enrichment.error =
                error instanceof Error ? error.message : 'Failed to enqueue enrichment job';
        }

        return report;
    }

    async createJob(organizationId: string, input: CreateScrapingJobInput) {
        await billingService.assertConcurrentJobsLimit(organizationId, 1);
        if (input.schedule) {
            await billingService.assertAutomationRulesLimit(organizationId, 1);
        }

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

        const baseWhere: Prisma.LeadWhereInput = {
            organizationId,
            scrapingJobId: jobId,
        };

        const [leads, total, statusGroups, totalInJob] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take: query.limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.lead.count({ where }),
            prisma.lead.groupBy({
                by: ['status'],
                where: baseWhere,
                _count: { _all: true },
            }),
            prisma.lead.count({ where: baseWhere }),
        ]);

        const byStatus: Record<string, number> = {};
        for (const entry of statusGroups) {
            byStatus[entry.status] = entry._count._all;
        }

        const statusSummary: LeadStatusSummary = {
            total: totalInJob,
            byStatus,
        };

        return { leads, total, statusSummary };
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
        await billingService.assertConcurrentJobsLimit(organizationId, 1);

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
                leadsCreated: 0,
                errors: Prisma.JsonNull,
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
        const normalizedLeads = leadsPayload.map((lead) => normalizeLead(lead, job.source));
        const leadsWithIdentity = normalizedLeads.filter(hasLeadIdentity);
        const droppedInvalid = normalizedLeads.length - leadsWithIdentity.length;
        const acceptedLeads = leadsWithIdentity.filter((lead) => !shouldDropMockLead(lead));
        const droppedMockTagged = leadsWithIdentity.length - acceptedLeads.length;

        const leadsToCreate = acceptedLeads.map((lead) => ({
            ...lead,
            organizationId: job.organizationId,
            scrapingJobId: job.id,
            sourceFingerprint: buildLeadFingerprint(lead, job.source),
        }));

        let createdCount = 0;
        let droppedByLimit = 0;
        let createdLeadIds: string[] = [];
        let createdLeadIdByFingerprint: Record<string, string> = {};
        if (leadsToCreate.length > 0) {
            const result = await prisma.$transaction(async (tx) => {
                const remaining = await billingService.getRemainingLeadsTx(tx, job.organizationId);
                if (remaining <= 0) {
                    return {
                        count: 0,
                        dropped: leadsToCreate.length,
                        createdLeadIds: [] as string[],
                        createdLeadIdByFingerprint: {} as Record<string, string>,
                    };
                }

                const cappedLeads = leadsToCreate.slice(0, remaining);
                const cappedFingerprints = Array.from(
                    new Set(
                        cappedLeads
                            .map((lead) =>
                                typeof lead.sourceFingerprint === 'string'
                                    ? lead.sourceFingerprint
                                    : undefined
                            )
                            .filter((value): value is string => Boolean(value))
                    )
                );
                const existingFingerprints = new Set<string>();
                if (cappedFingerprints.length > 0) {
                    const existingLeads = await tx.lead.findMany({
                        where: {
                            organizationId: job.organizationId,
                            sourceFingerprint: {
                                in: cappedFingerprints,
                            },
                        },
                        select: {
                            sourceFingerprint: true,
                        },
                    });

                    for (const item of existingLeads) {
                        if (item.sourceFingerprint) {
                            existingFingerprints.add(item.sourceFingerprint);
                        }
                    }
                }

                const createResult = await tx.lead.createMany({
                    data: cappedLeads,
                    skipDuplicates: true,
                });

                const insertedFingerprints = cappedFingerprints.filter(
                    (fingerprint) => !existingFingerprints.has(fingerprint)
                );
                const insertedLeads =
                    insertedFingerprints.length > 0
                        ? await tx.lead.findMany({
                              where: {
                                  organizationId: job.organizationId,
                                  sourceFingerprint: {
                                      in: insertedFingerprints,
                                  },
                              },
                              select: {
                                  id: true,
                                  sourceFingerprint: true,
                              },
                          })
                        : [];

                if (createResult.count > 0) {
                    await billingService.consumeLeadsTx(
                        tx,
                        job.organizationId,
                        createResult.count,
                        `scraping:${job.id}:leads:${job.processedItems || 0}`
                    );
                    await tx.organization.update({
                        where: { id: job.organizationId },
                        data: { leadsUsed: { increment: createResult.count } },
                    });
                }

                return {
                    count: createResult.count,
                    dropped: Math.max(leadsToCreate.length - cappedLeads.length, 0),
                    createdLeadIds: insertedLeads.map((lead) => lead.id),
                    createdLeadIdByFingerprint: Object.fromEntries(
                        insertedLeads
                            .filter((lead) => Boolean(lead.sourceFingerprint))
                            .map((lead) => [lead.sourceFingerprint as string, lead.id])
                    ),
                };
            });
            createdCount = result.count;
            droppedByLimit = result.dropped;
            createdLeadIds = result.createdLeadIds;
            createdLeadIdByFingerprint = result.createdLeadIdByFingerprint;
        }

        try {
            const payloadWithFingerprint = acceptedLeads.map((lead) => ({
                ...lead,
                sourceFingerprint: buildLeadFingerprint(lead, job.source),
            }));
            await leadPoolService.ingest({
                organizationId: job.organizationId,
                source: job.source,
                leads: payloadWithFingerprint,
                scrapingJobId: job.id,
                leadIdByFingerprint: createdLeadIdByFingerprint,
            });
        } catch (error) {
            console.error(`[scraping:webhook] failed to ingest lead pool for job=${job.id}`, error);
        }

        const status = payload.status ? normalizeStatus(payload.status) : job.status;
        const totalItems = payload.totalItems ?? (job.totalItems || leadsToCreate.length);
        const processedItems =
            payload.processedItems ?? (job.processedItems || leadsToCreate.length);
        const leadsCreated = job.leadsCreated + createdCount;
        const debugInfo =
            payload.debug && typeof payload.debug === 'object'
                ? (payload.debug as Record<string, unknown>)
                : undefined;
        const nestedScraperDebug =
            debugInfo?.['scraperDebug'] &&
            typeof debugInfo['scraperDebug'] === 'object' &&
            !Array.isArray(debugInfo['scraperDebug'])
                ? (debugInfo['scraperDebug'] as Record<string, unknown>)
                : undefined;
        const finalLeadCountHint =
            typeof debugInfo?.['finalLeadCount'] === 'number'
                ? (debugInfo['finalLeadCount'] as number)
                : typeof nestedScraperDebug?.['finalLeadCount'] === 'number'
                    ? (nestedScraperDebug['finalLeadCount'] as number)
                    : undefined;
        const persistedLeadCount =
            status === 'COMPLETED' && leadsCreated === 0
                ? await prisma.lead.count({ where: { scrapingJobId: job.id } })
                : undefined;
        const shouldWarnNoLeads =
            status === 'COMPLETED' &&
            leadsCreated === 0 &&
            (persistedLeadCount ?? 0) === 0 &&
            (finalLeadCountHint === undefined || finalLeadCountHint === 0);
        const shouldWarnDroppedMockLeads =
            status === 'COMPLETED' && droppedMockTagged > 0;
        const isCompletionTransition = status === 'COMPLETED' && job.status !== 'COMPLETED';
        let postCapture: PostCapturePipelineReport | null = null;
        if (isCompletionTransition) {
            postCapture = await this.runPostCapturePipeline(job.organizationId, job.id);
        }

        const diagnostics = {
            status,
            payloadLeadCount: leadsPayload.length,
            normalizedLeadCount: normalizedLeads.length,
            identityLeadCount: leadsWithIdentity.length,
            acceptedLeadCount: acceptedLeads.length,
            droppedInvalid,
            droppedMockTagged,
            createdCount,
            droppedByLimit,
            createdLeadIdsCount: createdLeadIds.length,
            totalItems,
            processedItems,
            persistedLeadCount: persistedLeadCount ?? null,
            postCapture,
            scraperDebug: payload.debug ?? null,
            at: new Date().toISOString(),
        };

        console.info(
            `[scraping:webhook] job=${job.id} status=${status} payloadLeads=${leadsPayload.length} accepted=${acceptedLeads.length} droppedMock=${droppedMockTagged} created=${createdCount} totalItems=${totalItems} processedItems=${processedItems}`
        );

        let errorsUpdate: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
        if (payload.error) {
            errorsUpdate = {
                error: payload.error,
                diagnostics,
            } as Prisma.InputJsonValue;
        } else if (shouldWarnDroppedMockLeads) {
            errorsUpdate = {
                warning: 'Mock-tagged leads were dropped by production safety filters',
                diagnostics,
            } as Prisma.InputJsonValue;
        } else if (shouldWarnNoLeads) {
            errorsUpdate = {
                warning: 'Scraping completed with no leads',
                diagnostics,
            } as Prisma.InputJsonValue;
        } else if (status === 'COMPLETED') {
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

        return {
            createdCount,
            postCapture,
        };
    }
}

export const scrapingService = new ScrapingService();

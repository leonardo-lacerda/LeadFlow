import { JobStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { enrichmentQueue } from '../../lib/queue.js';
import { cnpjProvider } from './providers/cnpj.provider.js';
import { domainProvider } from './providers/domain.provider.js';
import { icpProvider, type MaturityLevel } from './providers/icp.provider.js';
import { matchLeadAgainstIcp } from './icp-matcher.js';

interface CreateEnrichmentJobInput {
    name?: string;
    leadIds: string[];
    webhookUrl?: string;
}

interface ListJobsQuery {
    page: number;
    limit: number;
}

interface EnrichmentWebhookPayload {
    jobId: string;
    status?: string;
    progress?: number;
    totalItems?: number;
    processedItems?: number;
    leads?: Array<Record<string, unknown>>;
    error?: unknown;
}

const ENRICHMENT_FIELDS = new Set([
    'firstName',
    'lastName',
    'fullName',
    'email',
    'emailVerified',
    'phone',
    'whatsapp',
    'linkedinUrl',
    'companyName',
    'companyDomain',
    'companyCnpj',
    'companySize',
    'companyRevenue',
    'companyEmployees',
    'industry',
    'technologies',
    'maturityLevel',
    'icpReasons',
    'icpMatch',
    'jobTitle',
    'seniority',
    'department',
    'city',
    'state',
    'country',
    'source',
    'sourceUrl',
    'tags',
]);

function pickValue(lead: Record<string, unknown>, camel: string, snake: string) {
    return (lead[camel] ?? lead[snake]) as unknown;
}

function toBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    return undefined;
}

function toStringArray(value: unknown): string[] | undefined {
    if (!value) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return undefined;
}

function parseMaturity(value: unknown): MaturityLevel | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const normalized = value.toUpperCase();
    if (
        normalized === 'EARLY_STAGE' ||
        normalized === 'GROWING' ||
        normalized === 'ESTABLISHED' ||
        normalized === 'ENTERPRISE'
    ) {
        return normalized as MaturityLevel;
    }

    return undefined;
}

function normalizeLead(lead: Record<string, unknown>) {
    const firstName = pickValue(lead, 'firstName', 'first_name') as string | undefined;
    const lastName = pickValue(lead, 'lastName', 'last_name') as string | undefined;
    const fullName = pickValue(lead, 'fullName', 'full_name') as string | undefined;

    const normalized: Record<string, unknown> = {
        firstName,
        lastName,
        fullName,
        email: pickValue(lead, 'email', 'email'),
        emailVerified: toBoolean(pickValue(lead, 'emailVerified', 'email_verified')),
        phone: pickValue(lead, 'phone', 'phone'),
        whatsapp: pickValue(lead, 'whatsapp', 'whatsapp'),
        linkedinUrl: pickValue(lead, 'linkedinUrl', 'linkedin_url'),
        companyName: pickValue(lead, 'companyName', 'company_name'),
        companyDomain: pickValue(lead, 'companyDomain', 'company_domain'),
        companyCnpj: pickValue(lead, 'companyCnpj', 'company_cnpj'),
        companySize: pickValue(lead, 'companySize', 'company_size'),
        companyRevenue: pickValue(lead, 'companyRevenue', 'company_revenue'),
        companyEmployees: pickValue(lead, 'companyEmployees', 'company_employees'),
        industry: pickValue(lead, 'industry', 'industry'),
        technologies: toStringArray(
            pickValue(lead, 'technologies', 'technologies') ??
                pickValue(lead, 'technologyStack', 'technology_stack')
        ),
        maturityLevel: parseMaturity(
            pickValue(lead, 'maturityLevel', 'maturity_level')
        ),
        icpReasons: toStringArray(pickValue(lead, 'icpReasons', 'icp_reasons')),
        icpMatch: pickValue(lead, 'icpMatch', 'icp_match'),
        jobTitle: pickValue(lead, 'jobTitle', 'job_title'),
        seniority: pickValue(lead, 'seniority', 'seniority'),
        department: pickValue(lead, 'department', 'department'),
        city: pickValue(lead, 'city', 'city'),
        state: pickValue(lead, 'state', 'state'),
        country: pickValue(lead, 'country', 'country'),
        source: pickValue(lead, 'source', 'source'),
        sourceUrl: pickValue(lead, 'sourceUrl', 'source_url'),
        tags: (lead['tags'] as string[]) || undefined,
    };

    if (!fullName && (firstName || lastName)) {
        normalized.fullName = [firstName, lastName].filter(Boolean).join(' ');
    }

    return Object.fromEntries(
        Object.entries(normalized).filter(
            ([key, value]) => ENRICHMENT_FIELDS.has(key) && value !== undefined
        )
    );
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

function mergeStringArrays(...values: Array<string[] | undefined | null>) {
    return Array.from(
        new Set(
            values
                .flatMap((entry) => entry || [])
                .map((item) => item.trim())
                .filter(Boolean)
        )
    );
}

function pickNonEmpty(...values: Array<string | undefined | null>) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return undefined;
}

function toJsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

export class EnrichmentService {
    async createJob(organizationId: string, input: CreateEnrichmentJobInput) {
        const leads = await prisma.lead.findMany({
            where: { id: { in: input.leadIds }, organizationId },
            select: { id: true },
        });

        if (leads.length === 0) {
            throw new Error('No leads found for enrichment');
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                enrichmentsLimit: true,
                enrichmentsUsed: true,
            },
        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        const remaining = organization.enrichmentsLimit - organization.enrichmentsUsed;
        if (remaining < leads.length) {
            throw new Error('Enrichment limit exceeded');
        }

        const job = await prisma.enrichmentJob.create({
            data: {
                name: input.name || 'Enrichment job',
                query: { leadIds: leads.map((lead) => lead.id) },
                status: 'PENDING',
                totalItems: leads.length,
                organizationId,
            },
        });

        await prisma.lead.updateMany({
            where: { id: { in: leads.map((lead) => lead.id) }, organizationId },
            data: { status: 'ENRICHING' },
        });

        await enrichmentQueue.add('enrich', {
            jobId: job.id,
            organizationId,
            leadIds: leads.map((lead) => lead.id),
            webhookUrl: input.webhookUrl,
        });

        return job;
    }

    async listJobs(organizationId: string, query: ListJobsQuery) {
        const skip = (query.page - 1) * query.limit;
        const [jobs, total] = await Promise.all([
            prisma.enrichmentJob.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: query.limit,
            }),
            prisma.enrichmentJob.count({ where: { organizationId } }),
        ]);
        return { jobs, total };
    }

    async getJob(organizationId: string, jobId: string) {
        return prisma.enrichmentJob.findFirst({
            where: { id: jobId, organizationId },
        });
    }

    async handleWebhook(payload: EnrichmentWebhookPayload) {
        const job = await prisma.enrichmentJob.findUnique({
            where: { id: payload.jobId },
        });

        if (!job) {
            return null;
        }

        const organization = await prisma.organization.findUnique({
            where: { id: job.organizationId },
            select: {
                icpDefinition: true,
            },
        });

        const leadsPayload = payload.leads || [];
        let updatedCount = 0;
        const processedLeadIds = new Set(job.processedLeadIds || []);

        for (const lead of leadsPayload) {
            const leadId =
                (lead['leadId'] as string) ||
                (lead['lead_id'] as string) ||
                (lead['id'] as string);
            if (!leadId) {
                continue;
            }
            if (processedLeadIds.has(leadId)) {
                continue;
            }

            const existingLead = await prisma.lead.findFirst({
                where: { id: leadId, organizationId: job.organizationId },
                select: {
                    id: true,
                    email: true,
                    companyCnpj: true,
                    companyName: true,
                    companyDomain: true,
                    companySize: true,
                    companyRevenue: true,
                    companyEmployees: true,
                    industry: true,
                    technologies: true,
                    jobTitle: true,
                    seniority: true,
                    department: true,
                    city: true,
                    state: true,
                    country: true,
                    sourceUrl: true,
                    icpMatch: true,
                    icpReasons: true,
                    enrichmentData: true,
                },
            });

            if (!existingLead) {
                continue;
            }

            const normalized = normalizeLead(lead);
            const normalizedRecord = normalized as Record<string, unknown>;

            const cnpjResult = await cnpjProvider.enrich({
                companyCnpj: pickNonEmpty(
                    normalizedRecord['companyCnpj'] as string | undefined,
                    existingLead.companyCnpj
                ),
            });

            const domainResult = await domainProvider.enrich({
                companyDomain: pickNonEmpty(
                    normalizedRecord['companyDomain'] as string | undefined,
                    existingLead.companyDomain
                ),
                email: pickNonEmpty(
                    normalizedRecord['email'] as string | undefined,
                    existingLead.email
                ),
                sourceUrl: pickNonEmpty(
                    normalizedRecord['sourceUrl'] as string | undefined,
                    existingLead.sourceUrl
                ),
            });

            const mergedTechnologies = mergeStringArrays(
                existingLead.technologies,
                normalizedRecord['technologies'] as string[] | undefined,
                domainResult.technologies
            );

            const icpResult = icpProvider.classify(
                {
                    industry: pickNonEmpty(
                        normalizedRecord['industry'] as string | undefined,
                        cnpjResult.industry,
                        existingLead.industry
                    ),
                    jobTitle: pickNonEmpty(
                        normalizedRecord['jobTitle'] as string | undefined,
                        existingLead.jobTitle
                    ),
                    seniority: pickNonEmpty(
                        normalizedRecord['seniority'] as string | undefined,
                        existingLead.seniority
                    ),
                    city: pickNonEmpty(
                        normalizedRecord['city'] as string | undefined,
                        existingLead.city
                    ),
                    state: pickNonEmpty(
                        normalizedRecord['state'] as string | undefined,
                        existingLead.state
                    ),
                    country: pickNonEmpty(
                        normalizedRecord['country'] as string | undefined,
                        existingLead.country
                    ),
                    companySize: pickNonEmpty(
                        normalizedRecord['companySize'] as string | undefined,
                        cnpjResult.companySize,
                        existingLead.companySize
                    ),
                    companyEmployees: pickNonEmpty(
                        normalizedRecord['companyEmployees'] as string | undefined,
                        cnpjResult.companyEmployees,
                        existingLead.companyEmployees
                    ),
                    companyRevenue: pickNonEmpty(
                        normalizedRecord['companyRevenue'] as string | undefined,
                        cnpjResult.companyRevenue,
                        existingLead.companyRevenue
                    ),
                    technologies: mergedTechnologies,
                },
                (organization?.icpDefinition as Record<string, unknown> | null) ?? null
            );
            const matcherResult = matchLeadAgainstIcp(
                {
                    industry: pickNonEmpty(
                        normalizedRecord['industry'] as string | undefined,
                        cnpjResult.industry,
                        existingLead.industry
                    ),
                    jobTitle: pickNonEmpty(
                        normalizedRecord['jobTitle'] as string | undefined,
                        existingLead.jobTitle
                    ),
                    seniority: pickNonEmpty(
                        normalizedRecord['seniority'] as string | undefined,
                        existingLead.seniority
                    ),
                    department: pickNonEmpty(
                        normalizedRecord['department'] as string | undefined,
                        existingLead.department
                    ),
                    companySize: pickNonEmpty(
                        normalizedRecord['companySize'] as string | undefined,
                        cnpjResult.companySize,
                        existingLead.companySize
                    ),
                    city: pickNonEmpty(
                        normalizedRecord['city'] as string | undefined,
                        existingLead.city
                    ),
                    state: pickNonEmpty(
                        normalizedRecord['state'] as string | undefined,
                        existingLead.state
                    ),
                    country: pickNonEmpty(
                        normalizedRecord['country'] as string | undefined,
                        existingLead.country
                    ),
                },
                (organization?.icpDefinition as Record<string, unknown> | null) ?? null
            );

            const previousEnrichmentData = toJsonObject(existingLead.enrichmentData);
            const enrichedAt = new Date();

            const updateData = {
                ...normalized,
                companyName: pickNonEmpty(
                    normalizedRecord['companyName'] as string | undefined,
                    cnpjResult.companyName,
                    existingLead.companyName
                ),
                companyDomain: pickNonEmpty(
                    normalizedRecord['companyDomain'] as string | undefined,
                    domainResult.companyDomain,
                    existingLead.companyDomain
                ),
                companySize: pickNonEmpty(
                    normalizedRecord['companySize'] as string | undefined,
                    cnpjResult.companySize,
                    existingLead.companySize
                ),
                companyRevenue: pickNonEmpty(
                    normalizedRecord['companyRevenue'] as string | undefined,
                    cnpjResult.companyRevenue,
                    existingLead.companyRevenue
                ),
                companyEmployees: pickNonEmpty(
                    normalizedRecord['companyEmployees'] as string | undefined,
                    cnpjResult.companyEmployees,
                    existingLead.companyEmployees
                ),
                industry: pickNonEmpty(
                    normalizedRecord['industry'] as string | undefined,
                    cnpjResult.industry,
                    existingLead.industry
                ),
                technologies: mergedTechnologies,
                maturityLevel:
                    (normalizedRecord['maturityLevel'] as MaturityLevel | undefined) ||
                    icpResult.maturityLevel,
                icpReasons: mergeStringArrays(
                    existingLead.icpReasons,
                    normalizedRecord['icpReasons'] as string[] | undefined,
                    icpResult.icpReasons,
                    matcherResult.reasons
                ),
                icpMatch:
                    typeof icpResult.icpMatch === 'number'
                        ? Math.max(icpResult.icpMatch, matcherResult.icpMatch)
                        : matcherResult.icpMatch || existingLead.icpMatch || undefined,
                enrichedAt,
                enrichmentData: {
                    ...previousEnrichmentData,
                    latestRawPayload: lead,
                    advanced: {
                        cnpj: cnpjResult.metadata || null,
                        domain: domainResult.metadata || null,
                        icp: {
                            icpMatch:
                                typeof icpResult.icpMatch === 'number'
                                    ? Math.max(icpResult.icpMatch, matcherResult.icpMatch)
                                    : matcherResult.icpMatch || null,
                            reasons: mergeStringArrays(icpResult.icpReasons, matcherResult.reasons),
                            maturityLevel: icpResult.maturityLevel ?? null,
                        },
                        updatedAt: enrichedAt.toISOString(),
                    },
                } as Prisma.InputJsonValue,
                status: 'ENRICHED',
            } as Prisma.LeadUpdateInput;

            await prisma.lead.update({
                where: { id: leadId },
                data: updateData,
            });
            processedLeadIds.add(leadId);
            updatedCount += 1;
        }

        const status = payload.status ? normalizeStatus(payload.status) : job.status;
        const totalItems = payload.totalItems ?? (job.totalItems || updatedCount);
        const processedItems =
            payload.processedItems ?? job.processedItems + updatedCount;
        const leadsEnriched = job.leadsEnriched + updatedCount;

        await prisma.enrichmentJob.update({
            where: { id: job.id },
            data: {
                status,
                progress: payload.progress ?? (status === 'COMPLETED' ? 100 : job.progress),
                totalItems,
                processedItems,
                leadsEnriched,
                processedLeadIds: Array.from(processedLeadIds),
                errors: payload.error
                    ? ({ error: payload.error } as Prisma.InputJsonValue)
                    : (job.errors ?? undefined),
            },
        });

        if (updatedCount > 0) {
            await prisma.organization.update({
                where: { id: job.organizationId },
                data: { enrichmentsUsed: { increment: updatedCount } },
            });
        }

        return { updatedCount };
    }
}

export const enrichmentService = new EnrichmentService();

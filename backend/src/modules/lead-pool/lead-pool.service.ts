import { LeadStatus, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { normalizeCategory, normalizeLocationToken } from './category-normalizer.js';
import { dedupService, SharedLeadCandidate } from './dedup.service.js';
import { billingService } from '../billing/billing.service.js';

interface SearchInput {
    city?: string;
    state?: string;
    category?: string;
    source?: string;
    limit: number;
    page: number;
    freshnessDays?: number;
}

interface ClaimInput {
    sharedLeadId: string;
    leadId?: string;
    scrapingJobId?: string;
}

interface IngestInput {
    organizationId: string;
    source: string;
    leads: Array<Record<string, unknown>>;
    scrapingJobId?: string;
    leadIdByFingerprint?: Record<string, string>;
}

interface PreFetchInput {
    organizationId: string;
    source: string;
    query: Record<string, unknown>;
    scrapingJobId: string;
}

function cleanString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : null;
}

function toEmail(value: unknown): string | null {
    const normalized = cleanString(value);
    return normalized ? normalized.toLowerCase() : null;
}

function fingerprintForSharedLead(sharedLead: {
    googlePlaceId: string | null;
    companyCnpj: string | null;
    linkedinUrl: string | null;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    companyName: string | null;
}): string {
    const raw = [
        sharedLead.googlePlaceId,
        sharedLead.companyCnpj,
        sharedLead.linkedinUrl,
        sharedLead.email,
        sharedLead.phone,
        sharedLead.fullName,
        sharedLead.companyName,
    ]
        .map((item) => (item || '').toLowerCase().trim())
        .join('|');

    return crypto.createHash('sha256').update(raw).digest('hex');
}

function queryToken(query: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = query[key];
        const str = cleanString(value);
        if (str) {
            return str;
        }
    }
    return null;
}

function toCandidate(lead: Record<string, unknown>, source: string): SharedLeadCandidate {
    return {
        googlePlaceId: cleanString(lead['googlePlaceId'] || lead['google_place_id']),
        companyCnpj: cleanString(lead['companyCnpj'] || lead['company_cnpj']),
        linkedinUrl: cleanString(lead['linkedinUrl'] || lead['linkedin_url']),
        email: toEmail(lead['email']),
        phone: cleanString(lead['phone'] || lead['whatsapp']),
        fullName: cleanString(lead['fullName'] || lead['full_name']),
        companyName: cleanString(lead['companyName'] || lead['company_name']),
        website: cleanString(lead['website'] || lead['companyDomain'] || lead['company_domain']),
        city: cleanString(lead['city']),
        state: cleanString(lead['state']),
        category: cleanString(lead['category'] || lead['industry'] || lead['segment']),
        source,
        rawData: lead as Prisma.InputJsonValue,
        quality: 60,
    };
}

export class LeadPoolService {
    async search(organizationId: string, input: SearchInput) {
        const page = Math.max(1, input.page);
        const limit = Math.max(1, Math.min(100, input.limit));
        const skip = (page - 1) * limit;

        const where: Prisma.SharedLeadWhereInput = {};
        const city = normalizeLocationToken(input.city);
        const state = normalizeLocationToken(input.state);
        const category = normalizeCategory(input.category);

        if (city) {
            where.city = {
                contains: city.replace(/_/g, ' '),
                mode: Prisma.QueryMode.insensitive,
            };
        }

        if (state) {
            where.state = {
                contains: state.replace(/_/g, ' '),
                mode: Prisma.QueryMode.insensitive,
            };
        }

        if (category) {
            where.category = {
                contains: category.replace(/_/g, ' '),
                mode: Prisma.QueryMode.insensitive,
            };
        }

        if (input.source) {
            where.source = input.source;
        }

        if (input.freshnessDays && input.freshnessDays > 0) {
            const cutoff = new Date(Date.now() - input.freshnessDays * 24 * 60 * 60 * 1000);
            where.lastScrapedAt = { gte: cutoff };
        }

        const [items, total, claims] = await Promise.all([
            prisma.sharedLead.findMany({
                where,
                orderBy: [{ quality: 'desc' }, { lastScrapedAt: 'desc' }],
                skip,
                take: limit,
            }),
            prisma.sharedLead.count({ where }),
            prisma.sharedLeadClaim.findMany({
                where: {
                    organizationId,
                },
                select: {
                    sharedLeadId: true,
                    leadId: true,
                },
            }),
        ]);

        const claimMap = new Map(claims.map((claim) => [claim.sharedLeadId, claim.leadId]));

        return {
            items: items.map((item) => ({
                ...item,
                claimed: claimMap.has(item.id),
                claimedLeadId: claimMap.get(item.id) || null,
            })),
            total,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async claim(organizationId: string, input: ClaimInput) {
        const sharedLead = await prisma.sharedLead.findUnique({
            where: {
                id: input.sharedLeadId,
            },
        });

        if (!sharedLead) {
            throw new Error('Shared lead not found');
        }

        let leadId = input.leadId || null;

        if (!leadId) {
            const sourceFingerprint = fingerprintForSharedLead(sharedLead);

            const existingLead = await prisma.lead.findFirst({
                where: {
                    organizationId,
                    sourceFingerprint,
                },
                select: {
                    id: true,
                },
            });

            if (existingLead) {
                leadId = existingLead.id;
            } else {
                const created = await prisma.$transaction(async (tx) => {
                    await billingService.consumeLeadsTx(tx, organizationId, 1);

                    const lead = await tx.lead.create({
                        data: {
                            organizationId,
                            scrapingJobId: input.scrapingJobId,
                            sourceFingerprint,
                            source: `shared_pool:${sharedLead.source}`,
                            sourceUrl: sharedLead.website || undefined,
                            fullName: sharedLead.fullName || undefined,
                            email: sharedLead.email || undefined,
                            phone: sharedLead.phone || undefined,
                            companyName: sharedLead.companyName || undefined,
                            companyCnpj: sharedLead.companyCnpj || undefined,
                            linkedinUrl: sharedLead.linkedinUrl || undefined,
                            city: sharedLead.city || undefined,
                            state: sharedLead.state || undefined,
                            industry: sharedLead.category || undefined,
                            status: LeadStatus.NEW,
                            tags: ['shared-pool', sharedLead.source],
                        },
                        select: {
                            id: true,
                        },
                    });

                    await tx.organization.update({
                        where: {
                            id: organizationId,
                        },
                        data: {
                            leadsUsed: {
                                increment: 1,
                            },
                        },
                    });

                    return lead;
                });

                leadId = created.id;
            }
        }

        const claim = await prisma.sharedLeadClaim.upsert({
            where: {
                sharedLeadId_organizationId: {
                    sharedLeadId: sharedLead.id,
                    organizationId,
                },
            },
            update: {
                leadId: leadId || undefined,
                claimedAt: new Date(),
            },
            create: {
                sharedLeadId: sharedLead.id,
                organizationId,
                leadId: leadId || undefined,
            },
        });

        return {
            claim,
            leadId,
        };
    }

    async stats(organizationId: string) {
        const [sharedLeads, sharedLeads30d, orgClaims, withLead] = await Promise.all([
            prisma.sharedLead.count(),
            prisma.sharedLead.count({
                where: {
                    lastScrapedAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.sharedLeadClaim.count({
                where: {
                    organizationId,
                },
            }),
            prisma.sharedLeadClaim.count({
                where: {
                    organizationId,
                    leadId: {
                        not: null,
                    },
                },
            }),
        ]);

        return {
            sharedLeads,
            sharedLeads30d,
            orgClaims,
            claimedWithLead: withLead,
        };
    }

    async ingest(input: IngestInput) {
        let upserted = 0;
        let claimed = 0;

        for (const lead of input.leads) {
            const candidate = toCandidate(lead, input.source);
            const sharedLead = await dedupService.upsertSharedLead(candidate);
            upserted += 1;

            const fingerprint = cleanString(lead['sourceFingerprint']);
            const leadId =
                (fingerprint && input.leadIdByFingerprint?.[fingerprint]) ||
                cleanString(lead['leadId']) ||
                null;

            await prisma.sharedLeadClaim.upsert({
                where: {
                    sharedLeadId_organizationId: {
                        sharedLeadId: sharedLead.id,
                        organizationId: input.organizationId,
                    },
                },
                update: {
                    leadId: leadId || undefined,
                    claimedAt: new Date(),
                },
                create: {
                    sharedLeadId: sharedLead.id,
                    organizationId: input.organizationId,
                    leadId: leadId || undefined,
                },
            });
            claimed += 1;
        }

        return {
            upserted,
            claimed,
        };
    }

    async preFetch(input: PreFetchInput) {
        const source = input.source;
        if (source !== 'google_maps' && source !== 'cnpj' && source !== 'linkedin_dork') {
            return {
                matched: 0,
                claimed: 0,
                cacheHint: false,
            };
        }

        const city = queryToken(input.query, ['city', 'cidade', 'location', 'local']);
        const state = queryToken(input.query, ['state', 'estado', 'uf']);
        const category = queryToken(input.query, ['category', 'segment', 'industry', 'niche', 'query']);

        if (!city && !category) {
            return {
                matched: 0,
                claimed: 0,
                cacheHint: false,
            };
        }

        const search = await this.search(input.organizationId, {
            city: city || undefined,
            state: state || undefined,
            category: category || undefined,
            source,
            page: 1,
            limit: 40,
            freshnessDays: 45,
        });

        let claimed = 0;

        for (const item of search.items) {
            if (item.claimed) {
                continue;
            }
            if (item.quality < 35) {
                continue;
            }
            await this.claim(input.organizationId, {
                sharedLeadId: item.id,
                scrapingJobId: input.scrapingJobId,
            });
            claimed += 1;
        }

        return {
            matched: search.total,
            claimed,
            cacheHint: search.total > 0,
        };
    }
}

export const leadPoolService = new LeadPoolService();

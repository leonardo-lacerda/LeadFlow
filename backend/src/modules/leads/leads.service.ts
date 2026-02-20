import { prisma } from '../../lib/prisma.js';
import { LeadStatus, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { enrichmentService } from '../enrichment/enrichment.service.js';

interface CreateLeadData {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    emailVerified?: boolean;
    phone?: string;
    whatsapp?: string;
    linkedinUrl?: string;
    companyName?: string;
    companyDomain?: string;
    companyCnpj?: string;
    companySize?: string;
    industry?: string;
    jobTitle?: string;
    seniority?: string;
    department?: string;
    city?: string;
    state?: string;
    country?: string;
    score?: number;
    icpMatch?: number;
    source?: string;
    sourceUrl?: string;
    tags?: string[];
    status?: LeadStatus;
    assignedToUserId?: string | null;
    inboxStarred?: boolean;
}

interface ListLeadsQuery {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    source?: string;
    tags?: string;
}

function isLeadStatus(value: string): value is LeadStatus {
    return Object.values(LeadStatus).includes(value as LeadStatus);
}

export class LeadsService {
    async create(organizationId: string, data: CreateLeadData) {
        const lead = await prisma.$transaction(async (tx) => {
            const organization = await tx.organization.findUnique({
                where: { id: organizationId },
                select: {
                    leadsLimit: true,
                    leadsUsed: true,
                },
            });

            if (!organization) {
                throw new Error('Organization not found');
            }

            if (organization.leadsUsed + 1 > organization.leadsLimit) {
                throw new Error('Leads limit exceeded');
            }

            const created = await tx.lead.create({
                data: {
                    ...data,
                    organizationId,
                    tags: data.tags ?? [],
                },
            });

            await tx.organization.update({
                where: { id: organizationId },
                data: {
                    leadsUsed: { increment: 1 },
                },
            });

            return created;
        });

        if (env.AUTO_ENRICH_LEADS && !lead.emailVerified) {
            try {
                await enrichmentService.createJob(organizationId, {
                    name: `Auto enrichment for ${lead.id}`,
                    leadIds: [lead.id],
                });
            } catch (error) {
                console.warn('Auto enrichment failed:', error);
            }
        }

        return lead;
    }

    async bulkCreate(organizationId: string, leads: CreateLeadData[]) {
        const payload = leads.map((lead) => ({
            ...lead,
            organizationId,
            tags: lead.tags ?? [],
        }));

        const created = await prisma.$transaction(async (tx) => {
            const organization = await tx.organization.findUnique({
                where: { id: organizationId },
                select: {
                    leadsLimit: true,
                    leadsUsed: true,
                },
            });

            if (!organization) {
                throw new Error('Organization not found');
            }

            if (organization.leadsUsed + payload.length > organization.leadsLimit) {
                throw new Error('Leads limit exceeded');
            }

            const createdLeads = await Promise.all(
                payload.map((data) =>
                    tx.lead.create({
                        data,
                    })
                )
            );

            await tx.organization.update({
                where: { id: organizationId },
                data: {
                    leadsUsed: { increment: createdLeads.length },
                },
            });

            return createdLeads;
        });

        if (env.AUTO_ENRICH_LEADS) {
            const leadIds = created.filter((lead) => !lead.emailVerified).map((lead) => lead.id);
            if (leadIds.length > 0) {
                try {
                    await enrichmentService.createJob(organizationId, {
                        name: `Auto enrichment for ${leadIds.length} leads`,
                        leadIds,
                    });
                } catch (error) {
                    console.warn('Auto enrichment failed:', error);
                }
            }
        }

        return { created: created.length };
    }

    async list(organizationId: string, query: ListLeadsQuery) {
        const { page, limit, search, status, source, tags } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.LeadWhereInput = { organizationId };

        // Search filter (fullName, email, companyName)
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Status filter
        if (status && isLeadStatus(status)) {
            where.status = status;
        }

        // Source filter
        if (source) {
            where.source = source;
        }

        // Tags filter
        if (tags) {
            const tagArray = tags.split(',');
            where.tags = { hasSome: tagArray };
        }

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.lead.count({ where }),
        ]);

        return { leads, total };
    }

    async getById(organizationId: string, leadId: string) {
        const lead = await prisma.lead.findFirst({
            where: {
                id: leadId,
                organizationId,
            },
            include: {
                activities: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                },
                messages: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        return lead;
    }

    async update(organizationId: string, leadId: string, data: Partial<CreateLeadData>) {
        const lead = await prisma.lead.updateMany({
            where: {
                id: leadId,
                organizationId,
            },
            data,
        });

        if (lead.count === 0) {
            throw new Error('Lead not found');
        }

        return prisma.lead.findUnique({ where: { id: leadId } });
    }

    async delete(organizationId: string, leadId: string) {
        const lead = await prisma.lead.deleteMany({
            where: {
                id: leadId,
                organizationId,
            },
        });

        if (lead.count === 0) {
            throw new Error('Lead not found');
        }

        return true;
    }
}

export const leadsService = new LeadsService();

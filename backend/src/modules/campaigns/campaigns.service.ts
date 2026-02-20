import { prisma } from '../../lib/prisma.js';
import { campaignQueue } from '../../lib/queue.js';
import {
    CampaignLeadStatus,
    CampaignStatus,
    CampaignType,
    Prisma,
} from '@prisma/client';

interface CreateCampaignStep {
    type: 'EMAIL' | 'WHATSAPP' | 'WAIT' | 'CONDITION';
    subject?: string;
    content: string;
    delayHours?: number;
    delayDays?: number;
    templateId?: string;
}

interface CreateCampaignData {
    name: string;
    type: 'EMAIL' | 'WHATSAPP' | 'MULTI_CHANNEL';
    leadIds: string[];
    steps: CreateCampaignStep[];
    settings?: Prisma.InputJsonValue;
    schedule?: Prisma.InputJsonValue;
}

interface ListQueryParams {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    type?: string;
}

interface AddStepInput {
    type: 'EMAIL' | 'WHATSAPP' | 'WAIT' | 'CONDITION';
    subject?: string;
    content: string;
    templateId?: string;
    delayDays?: number;
    delayHours?: number;
}

interface AddLeadsInput {
    leadIds: string[];
}

function isCampaignStatus(value: string): value is CampaignStatus {
    return Object.values(CampaignStatus).includes(value as CampaignStatus);
}

function isCampaignType(value: string): value is CampaignType {
    return Object.values(CampaignType).includes(value as CampaignType);
}

function isCampaignLeadStatus(value: string): value is CampaignLeadStatus {
    return Object.values(CampaignLeadStatus).includes(value as CampaignLeadStatus);
}

class CampaignsService {
    async create(organizationId: string, data: CreateCampaignData) {
        // Validate leads belong to organization
        const leads = await prisma.lead.findMany({
            where: {
                id: { in: data.leadIds },
                organizationId,
            },
        });

        if (leads.length !== data.leadIds.length) {
            throw new Error('Some leads do not exist or do not belong to this organization');
        }

        // Create campaign with steps and lead associations
        const campaign = await prisma.campaign.create({
            data: {
                name: data.name,
                type: data.type,
                status: 'DRAFT',
                organizationId,
                settings: data.settings || {},
                schedule: data.schedule || {},
                steps: {
                    create: data.steps.map((step, index) => ({
                        order: index,
                        type: step.type,
                        subject: step.subject,
                        content: step.content,
                        delayHours: step.delayHours || 0,
                        delayDays: step.delayDays || 0,
                        templateId: step.templateId,
                    })),
                },
                leads: {
                    create: data.leadIds.map((leadId) => ({
                        leadId,
                        status: 'PENDING',
                        currentStep: 0,
                    })),
                },
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
                leads: {
                    include: {
                        lead: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                companyName: true,
                            },
                        },
                    },
                },
            },
        });

        return campaign;
    }

    async list(organizationId: string, params: ListQueryParams) {
        const { page, limit, search, status, type } = params;
        const skip = (page - 1) * limit;

        const statusFilter = status && isCampaignStatus(status) ? status : undefined;
        const typeFilter = type && isCampaignType(type) ? type : undefined;

        const where: Prisma.CampaignWhereInput = {
            organizationId,
            ...(statusFilter && { status: statusFilter }),
            ...(typeFilter && { type: typeFilter }),
            ...(search && {
                name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                },
            }),
        };

        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    steps: {
                        orderBy: { order: 'asc' },
                    },
                    leads: {
                        select: {
                            id: true,
                            status: true,
                        },
                    },
                },
            }),
            prisma.campaign.count({ where }),
        ]);

        // Add computed stats for each campaign
        const campaignsWithStats = campaigns.map((campaign) => {
            const totalLeads = campaign.leads.length;
            const completedLeads = campaign.leads.filter((l) => l.status === 'COMPLETED').length;
            const repliedLeads = campaign.leads.filter((l) => l.status === 'REPLIED').length;

            return {
                ...campaign,
                stats: {
                    totalLeads,
                    completedLeads,
                    repliedLeads,
                    conversionRate: totalLeads > 0 ? (repliedLeads / totalLeads) * 100 : 0,
                },
            };
        });

        return {
            campaigns: campaignsWithStats,
            total,
        };
    }

    async getById(organizationId: string, campaignId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
                leads: {
                    include: {
                        lead: true,
                    },
                },
            },
        });

        return campaign;
    }

    async updateStatus(
        organizationId: string,
        campaignId: string,
        status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
    ) {
        // Verify campaign belongs to organization
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        // Update status
        const updated = await prisma.campaign.update({
            where: { id: campaignId },
            data: { status },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
                leads: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
        });

        return updated;
    }

    async getCampaignLeads(
        organizationId: string,
        campaignId: string,
        params: {
            page: number;
            limit: number;
            search?: string;
            status?: string;
        }
    ) {
        // Verify campaign belongs to organization
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        const { page, limit, search, status } = params;
        const skip = (page - 1) * limit;

        const statusFilter = status && isCampaignLeadStatus(status) ? status : undefined;

        const where: Prisma.CampaignLeadWhereInput = {
            campaignId,
            ...(statusFilter && { status: statusFilter }),
            ...(search && {
                lead: {
                    OR: [
                        { fullName: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
                    ],
                },
            }),
        };

        const [leads, total] = await Promise.all([
            prisma.campaignLead.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: {
                    lead: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            companyName: true,
                            jobTitle: true,
                            phone: true,
                        },
                    },
                },
            }),
            prisma.campaignLead.count({ where }),
        ]);

        return {
            leads,
            total,
        };
    }

    async addStep(organizationId: string, campaignId: string, input: AddStepInput) {
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, organizationId },
            include: { steps: true },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        const order = campaign.steps.length;

        const step = await prisma.campaignStep.create({
            data: {
                campaignId,
                order,
                type: input.type,
                subject: input.subject,
                content: input.content,
                templateId: input.templateId,
                delayDays: input.delayDays || 0,
                delayHours: input.delayHours || 0,
            },
        });

        return step;
    }

    async addLeads(organizationId: string, campaignId: string, input: AddLeadsInput) {
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        const leads = await prisma.lead.findMany({
            where: { id: { in: input.leadIds }, organizationId },
            select: { id: true },
        });

        if (leads.length === 0) {
            throw new Error('No leads found');
        }

        const existing = await prisma.campaignLead.findMany({
            where: { campaignId, leadId: { in: leads.map((lead) => lead.id) } },
            select: { leadId: true },
        });

        const existingIds = new Set(existing.map((item) => item.leadId));
        const newLeads = leads.filter((lead) => !existingIds.has(lead.id));

        if (newLeads.length === 0) {
            return { created: 0 };
        }

        await prisma.campaignLead.createMany({
            data: newLeads.map((lead) => ({
                leadId: lead.id,
                campaignId,
                status: 'PENDING',
                currentStep: 0,
            })),
        });

        if (campaign.status === 'ACTIVE') {
            await this.scheduleLeads(campaignId, newLeads.map((lead) => lead.id));
        }

        return { created: newLeads.length };
    }

    async launch(organizationId: string, campaignId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, organizationId },
            include: { steps: { orderBy: { order: 'asc' } } },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (campaign.steps.length === 0) {
            throw new Error('Campaign has no steps');
        }

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'ACTIVE' },
        });

        await prisma.campaignLead.updateMany({
            where: {
                campaignId,
                status: { in: ['PENDING', 'PAUSED'] },
            },
            data: { status: 'IN_PROGRESS' },
        });

        await this.scheduleLeads(campaignId);

        return true;
    }

    async pause(organizationId: string, campaignId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED' },
        });

        await prisma.campaignLead.updateMany({
            where: {
                campaignId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            data: { status: 'PAUSED' },
        });

        return true;
    }

    async resume(organizationId: string, campaignId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'ACTIVE' },
        });

        await prisma.campaignLead.updateMany({
            where: { campaignId, status: 'PAUSED' },
            data: { status: 'IN_PROGRESS' },
        });

        await this.scheduleLeads(campaignId);

        return true;
    }

    async scheduleLeads(campaignId: string, leadIds?: string[]) {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: { steps: { orderBy: { order: 'asc' } } },
        });
        if (!campaign || campaign.steps.length === 0) {
            return;
        }

        const leads = await prisma.campaignLead.findMany({
            where: {
                campaignId,
                ...(leadIds ? { leadId: { in: leadIds } } : {}),
                status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
        });

        for (const lead of leads) {
            const step = campaign.steps[lead.currentStep] || campaign.steps[0];
            if (!step) {
                await prisma.campaignLead.update({
                    where: { id: lead.id },
                    data: { status: 'COMPLETED', nextActionAt: null },
                });
                continue;
            }
            const delayMs = this.delayForStep(step);
            const nextActionAt = new Date(Date.now() + delayMs);

            await prisma.campaignLead.update({
                where: { id: lead.id },
                data: { nextActionAt },
            });

            await this.enqueueLead(lead.id, lead.currentStep, nextActionAt);
        }
    }

    delayForStep(step: { delayDays: number; delayHours: number }) {
        const hours = (step.delayDays || 0) * 24 + (step.delayHours || 0);
        return Math.max(0, hours * 60 * 60 * 1000);
    }

    async enqueueLead(campaignLeadId: string, stepIndex: number, scheduledFor: Date) {
        const delay = Math.max(0, scheduledFor.getTime() - Date.now());
        await campaignQueue.add(
            'process',
            { campaignLeadId, scheduledFor: scheduledFor.toISOString(), stepIndex },
            {
                delay,
                removeOnComplete: true,
                removeOnFail: true,
            }
        );
    }

    async analytics(organizationId: string, campaignId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        const leadStats = await prisma.campaignLead.groupBy({
            by: ['status'],
            where: { campaignId },
            _count: { _all: true },
        });

        const messages = await prisma.message.findMany({
            where: {
                metadata: {
                    path: ['campaignId'],
                    equals: campaignId,
                },
            },
            select: {
                status: true,
                type: true,
                createdAt: true,
                metadata: true,
            },
        });

        const totals = {
            sent: 0,
            delivered: 0,
            opened: 0,
            replied: 0,
        };

        const stepStats: Record<
            string,
            { sent: number; replied: number; opened: number; clicked: number }
        > = {};
        const templateStats: Record<
            string,
            { sent: number; replied: number; opened: number; clicked: number }
        > = {};
        const daily: Record<string, number> = {};

        for (const message of messages) {
            if (message.status === 'SENT') totals.sent += 1;
            if (message.status === 'DELIVERED') totals.delivered += 1;
            if (message.status === 'OPENED') totals.opened += 1;
            if (message.status === 'REPLIED') totals.replied += 1;

            const meta = (message.metadata || {}) as Record<string, unknown>;
            const stepId = meta['stepId'] as string | undefined;
            if (stepId) {
                stepStats[stepId] = stepStats[stepId] || {
                    sent: 0,
                    replied: 0,
                    opened: 0,
                    clicked: 0,
                };
                if (message.status === 'SENT') stepStats[stepId].sent += 1;
                if (message.status === 'OPENED') stepStats[stepId].opened += 1;
                if (message.status === 'REPLIED') stepStats[stepId].replied += 1;
                if (message.status === 'CLICKED') stepStats[stepId].clicked += 1;
            }

            const templateId = meta['templateId'] as string | undefined;
            if (templateId) {
                templateStats[templateId] = templateStats[templateId] || {
                    sent: 0,
                    replied: 0,
                    opened: 0,
                    clicked: 0,
                };
                if (message.status === 'SENT') templateStats[templateId].sent += 1;
                if (message.status === 'OPENED') templateStats[templateId].opened += 1;
                if (message.status === 'REPLIED') templateStats[templateId].replied += 1;
                if (message.status === 'CLICKED') templateStats[templateId].clicked += 1;
            }

            const day = message.createdAt.toISOString().slice(0, 10);
            daily[day] = (daily[day] || 0) + 1;
        }

        return {
            leadStats,
            totals,
            stepStats,
            templateStats,
            abTests: templateStats,
            daily,
        };
    }

    async delete(organizationId: string, campaignId: string) {
        // Verify campaign belongs to organization
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        // Delete campaign (cascade will handle steps and leads)
        await prisma.campaign.delete({
            where: { id: campaignId },
        });

        return true;
    }
}

export const campaignsService = new CampaignsService();

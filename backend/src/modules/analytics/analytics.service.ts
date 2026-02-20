import { LeadStatus, MessageStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const CONTACTED_STATUSES = new Set<LeadStatus>([
    LeadStatus.CONTACTED,
    LeadStatus.REPLIED,
    LeadStatus.INTERESTED,
    LeadStatus.MEETING_SCHEDULED,
    LeadStatus.CONVERTED,
    LeadStatus.NOT_INTERESTED,
]);

const REPLIED_STATUSES = new Set<LeadStatus>([
    LeadStatus.REPLIED,
    LeadStatus.INTERESTED,
    LeadStatus.MEETING_SCHEDULED,
    LeadStatus.CONVERTED,
]);
const OPENED_MESSAGE_STATUSES = new Set<MessageStatus>([
    MessageStatus.OPENED,
    MessageStatus.CLICKED,
    MessageStatus.REPLIED,
]);
const EFFECTIVE_SENT_STATUSES = new Set<MessageStatus>([
    MessageStatus.SENT,
    MessageStatus.DELIVERED,
    MessageStatus.OPENED,
    MessageStatus.CLICKED,
    MessageStatus.REPLIED,
    MessageStatus.BOUNCED,
]);
const DEFAULT_MESSAGE_PERFORMANCE_DAYS = 60;
const DEFAULT_TIMING_HEATMAP_DAYS = 60;
const DEFAULT_RESPONSE_TIME_DAYS = 120;
const TIMING_HEATMAP_WEIGHTS = {
    replyRate: 0.55,
    openRate: 0.2,
    volume: 0.25,
} as const;

interface ResponseTimeStats {
    count: number;
    avgSeconds: number;
    avgHours: number;
    medianSeconds: number;
    p75Seconds: number;
    minSeconds: number;
    maxSeconds: number;
}

interface CampaignMetricSummary {
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    avgResponseTime: number;
    lastCalculatedAt: string;
}

function toRate(numerator: number, denominator: number) {
    if (!denominator) {
        return 0;
    }
    return Number(((numerator / denominator) * 100).toFixed(2));
}

function toSourceLabel(source: string | null) {
    if (!source || source.trim().length === 0) {
        return 'unknown';
    }
    return source;
}

function toIndustryLabel(industry: string | null) {
    if (!industry || industry.trim().length === 0) {
        return 'unknown';
    }
    return industry;
}

function metadataRecord(metadata: unknown) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }
    return metadata as Record<string, unknown>;
}

function percentile(values: number[], p: number) {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
    return sorted[index];
}

function summarizeResponseTimes(values: number[]): ResponseTimeStats {
    if (values.length === 0) {
        return {
            count: 0,
            avgSeconds: 0,
            avgHours: 0,
            medianSeconds: 0,
            p75Seconds: 0,
            minSeconds: 0,
            maxSeconds: 0,
        };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    const avgSeconds = total / sorted.length;

    return {
        count: sorted.length,
        avgSeconds: Number(avgSeconds.toFixed(1)),
        avgHours: Number((avgSeconds / 3600).toFixed(2)),
        medianSeconds: percentile(sorted, 0.5),
        p75Seconds: percentile(sorted, 0.75),
        minSeconds: sorted[0],
        maxSeconds: sorted[sorted.length - 1],
    };
}

function messageResponseTimeSeconds(message: {
    responseTime: number | null;
    sentAt: Date | null;
    repliedAt: Date | null;
    createdAt: Date;
}) {
    if (typeof message.responseTime === 'number' && message.responseTime >= 0) {
        return message.responseTime;
    }
    if (!message.repliedAt) {
        return null;
    }
    const base = message.sentAt || message.createdAt;
    const delta = Math.round((message.repliedAt.getTime() - base.getTime()) / 1000);
    return Math.max(0, delta);
}

function isLeadContacted(status: LeadStatus | null, outboundCount: number) {
    return outboundCount > 0 || (status ? CONTACTED_STATUSES.has(status) : false);
}

function isLeadReplied(status: LeadStatus | null, inboundCount: number) {
    return inboundCount > 0 || (status ? REPLIED_STATUSES.has(status) : false);
}

async function calculateCampaignMetrics(campaign: {
    id: string;
    organizationId: string;
    steps: Array<{ id: string }>;
}) {
    const messageFilters: Prisma.MessageWhereInput[] = [
        {
            metadata: {
                path: ['campaignId'],
                equals: campaign.id,
            },
        },
    ];

    const stepIds = campaign.steps.map((step) => step.id);
    if (stepIds.length > 0) {
        messageFilters.push({
            campaignStepId: { in: stepIds },
        });
    }

    const messages = await prisma.message.findMany({
        where: {
            lead: { organizationId: campaign.organizationId },
            direction: 'OUTBOUND',
            OR: messageFilters,
        },
        select: {
            status: true,
            responseTime: true,
            sentAt: true,
            repliedAt: true,
            createdAt: true,
        },
    });

    let sent = 0;
    let opened = 0;
    let replied = 0;
    let bounced = 0;
    const responseTimes: number[] = [];

    for (const message of messages) {
        if (EFFECTIVE_SENT_STATUSES.has(message.status)) {
            sent += 1;
        }
        if (OPENED_MESSAGE_STATUSES.has(message.status)) {
            opened += 1;
        }
        if (message.status === 'REPLIED') {
            replied += 1;
            const responseTime = messageResponseTimeSeconds(message);
            if (typeof responseTime === 'number') {
                responseTimes.push(responseTime);
            }
        }
        if (message.status === 'BOUNCED') {
            bounced += 1;
        }
    }

    const responseSummary = summarizeResponseTimes(responseTimes);
    const nowIso = new Date().toISOString();

    const metrics: CampaignMetricSummary = {
        sent,
        opened,
        replied,
        bounced,
        openRate: toRate(opened, sent),
        replyRate: toRate(replied, sent),
        bounceRate: toRate(bounced, sent),
        avgResponseTime: responseSummary.avgSeconds,
        lastCalculatedAt: nowIso,
    };

    return metrics;
}

export const analyticsService = {
    async getDashboardStats(organizationId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const totalLeads = await prisma.lead.count({
            where: { organizationId },
        });

        const leadsThisMonth = await prisma.lead.count({
            where: {
                organizationId,
                createdAt: { gte: startOfMonth },
            },
        });

        const leadsLastMonth = await prisma.lead.count({
            where: {
                organizationId,
                createdAt: {
                    gte: startOfLastMonth,
                    lte: endOfLastMonth,
                },
            },
        });

        const emailsSent = await prisma.message.count({
            where: {
                lead: { organizationId },
                type: 'EMAIL',
                direction: 'OUTBOUND',
                status: { in: Array.from(EFFECTIVE_SENT_STATUSES) },
            },
        });

        const emailsThisMonth = await prisma.message.count({
            where: {
                lead: { organizationId },
                type: 'EMAIL',
                direction: 'OUTBOUND',
                sentAt: { gte: startOfMonth },
                status: { in: Array.from(EFFECTIVE_SENT_STATUSES) },
            },
        });

        const emailsLastMonth = await prisma.message.count({
            where: {
                lead: { organizationId },
                type: 'EMAIL',
                direction: 'OUTBOUND',
                sentAt: {
                    gte: startOfLastMonth,
                    lte: endOfLastMonth,
                },
                status: { in: Array.from(EFFECTIVE_SENT_STATUSES) },
            },
        });

        const whatsappSent = await prisma.message.count({
            where: {
                lead: { organizationId },
                type: 'WHATSAPP',
                direction: 'OUTBOUND',
                status: { in: Array.from(EFFECTIVE_SENT_STATUSES) },
            },
        });

        const whatsappThisMonth = await prisma.message.count({
            where: {
                lead: { organizationId },
                type: 'WHATSAPP',
                direction: 'OUTBOUND',
                sentAt: { gte: startOfMonth },
                status: { in: Array.from(EFFECTIVE_SENT_STATUSES) },
            },
        });

        const whatsappLastMonth = await prisma.message.count({
            where: {
                lead: { organizationId },
                type: 'WHATSAPP',
                direction: 'OUTBOUND',
                sentAt: {
                    gte: startOfLastMonth,
                    lte: endOfLastMonth,
                },
                status: { in: Array.from(EFFECTIVE_SENT_STATUSES) },
            },
        });

        const totalSent = emailsSent + whatsappSent;
        const totalReplies = await prisma.message.count({
            where: {
                lead: { organizationId },
                direction: 'OUTBOUND',
                status: 'REPLIED',
            },
        });

        const responseRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

        const lastMonthSent = emailsLastMonth + whatsappLastMonth;
        const lastMonthReplies = await prisma.message.count({
            where: {
                lead: { organizationId },
                direction: 'OUTBOUND',
                status: 'REPLIED',
                createdAt: {
                    gte: startOfLastMonth,
                    lte: endOfLastMonth,
                },
            },
        });

        const lastMonthResponseRate =
            lastMonthSent > 0 ? (lastMonthReplies / lastMonthSent) * 100 : 0;

        const calculateChange = (current: number, previous: number): string => {
            if (previous === 0) {
                return current > 0 ? '+100%' : '0%';
            }
            const change = ((current - previous) / previous) * 100;
            return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        };

        return {
            totalLeads,
            emailsSent,
            whatsappSent,
            responseRate: responseRate.toFixed(1),
            changes: {
                leads: calculateChange(leadsThisMonth, leadsLastMonth),
                emails: calculateChange(emailsThisMonth, emailsLastMonth),
                whatsapp: calculateChange(whatsappThisMonth, whatsappLastMonth),
                responseRate: calculateChange(responseRate, lastMonthResponseRate),
            },
        };
    },

    async getRecentActivity(organizationId: string, limit = 10) {
        const recentMessages = await prisma.message.findMany({
            where: {
                lead: { organizationId },
                direction: 'OUTBOUND',
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                lead: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });

        return recentMessages.map((message) => ({
            id: message.id,
            type: message.type.toLowerCase(),
            description:
                message.type === 'EMAIL'
                    ? `Email enviado: ${message.subject || 'Sem assunto'}`
                    : 'Mensagem WhatsApp enviada',
            leadId: message.leadId,
            leadName: message.lead?.fullName || 'Unknown',
            leadEmail: message.lead?.email || '',
            timestamp: message.createdAt.toISOString(),
        }));
    },

    async getCampaignAnalytics(organizationId: string, campaignId?: string) {
        const where: Prisma.CampaignWhereInput = {
            organizationId,
            ...(campaignId ? { id: campaignId } : {}),
        };

        const campaigns = await prisma.campaign.findMany({
            where,
            select: {
                id: true,
                name: true,
                type: true,
                status: true,
                createdAt: true,
                metrics: true,
                lastMetricsAt: true,
                leads: {
                    select: {
                        status: true,
                    },
                },
            },
        });

        return campaigns.map((campaign) => {
            const totalLeads = campaign.leads.length;
            const repliedLeads = campaign.leads.filter((item) => item.status === 'REPLIED').length;
            const metrics = metadataRecord(campaign.metrics);
            const sent = typeof metrics['sent'] === 'number' ? metrics['sent'] : totalLeads;
            const opened =
                typeof metrics['opened'] === 'number'
                    ? metrics['opened']
                    : Math.round(sent * 0.6);
            const replied =
                typeof metrics['replied'] === 'number' ? metrics['replied'] : repliedLeads;

            return {
                id: campaign.id,
                name: campaign.name,
                type: campaign.type,
                status: campaign.status,
                stats: {
                    sent,
                    opened,
                    replied,
                },
                metrics: campaign.metrics,
                lastMetricsAt: campaign.lastMetricsAt?.toISOString() || null,
                createdAt: campaign.createdAt.toISOString(),
            };
        });
    },

    async getSourcePerformance(organizationId: string) {
        const leads = await prisma.lead.findMany({
            where: { organizationId },
            select: {
                source: true,
                status: true,
                _count: {
                    select: {
                        messages: {
                            where: { direction: 'OUTBOUND' },
                        },
                    },
                },
            },
        });

        const buckets = new Map<
            string,
            {
                source: string;
                totalLeads: number;
                contactedLeads: number;
                repliedLeads: number;
                meetingLeads: number;
                convertedLeads: number;
            }
        >();

        for (const lead of leads) {
            const source = toSourceLabel(lead.source);
            if (!buckets.has(source)) {
                buckets.set(source, {
                    source,
                    totalLeads: 0,
                    contactedLeads: 0,
                    repliedLeads: 0,
                    meetingLeads: 0,
                    convertedLeads: 0,
                });
            }

            const bucket = buckets.get(source)!;
            bucket.totalLeads += 1;

            const contacted = isLeadContacted(lead.status, lead._count.messages);
            const replied = isLeadReplied(lead.status, 0);
            const meeting = lead.status === 'MEETING_SCHEDULED' || lead.status === 'CONVERTED';
            const converted = lead.status === 'CONVERTED';

            if (contacted) {
                bucket.contactedLeads += 1;
            }
            if (replied) {
                bucket.repliedLeads += 1;
            }
            if (meeting) {
                bucket.meetingLeads += 1;
            }
            if (converted) {
                bucket.convertedLeads += 1;
            }
        }

        const items = Array.from(buckets.values())
            .map((bucket) => ({
                ...bucket,
                replyRate: toRate(bucket.repliedLeads, bucket.contactedLeads),
                meetingRate: toRate(bucket.meetingLeads, bucket.contactedLeads),
                conversionRate: toRate(bucket.convertedLeads, bucket.contactedLeads),
            }))
            .sort((a, b) => {
                if (b.replyRate !== a.replyRate) {
                    return b.replyRate - a.replyRate;
                }
                return b.contactedLeads - a.contactedLeads;
            });

        return {
            items,
            totalLeads: leads.length,
        };
    },

    async getMessagePerformance(
        organizationId: string,
        days = DEFAULT_MESSAGE_PERFORMANCE_DAYS
    ) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const messages = await prisma.message.findMany({
            where: {
                direction: 'OUTBOUND',
                lead: { organizationId },
                createdAt: { gte: since },
            },
            select: {
                id: true,
                type: true,
                status: true,
                metadata: true,
                campaignStepId: true,
                lead: {
                    select: {
                        industry: true,
                    },
                },
            },
        });

        const templateIds = new Set<string>();
        for (const message of messages) {
            const meta = metadataRecord(message.metadata);
            const templateId = typeof meta['templateId'] === 'string' ? meta['templateId'] : null;
            if (templateId) {
                templateIds.add(templateId);
            }
        }

        const templateArray = Array.from(templateIds);
        const templates =
            templateArray.length > 0
                ? await prisma.template.findMany({
                      where: { organizationId, id: { in: templateArray } },
                      select: { id: true, name: true },
                  })
                : [];
        const templateNames = new Map(templates.map((template) => [template.id, template.name]));

        const buckets = new Map<
            string,
            {
                channel: 'EMAIL' | 'WHATSAPP';
                templateId: string | null;
                templateName: string;
                industry: string;
                sent: number;
                opened: number;
                replied: number;
                bounced: number;
            }
        >();

        for (const message of messages) {
            const meta = metadataRecord(message.metadata);
            const templateId =
                (typeof meta['templateId'] === 'string' ? meta['templateId'] : null) ||
                message.campaignStepId ||
                (typeof meta['stepId'] === 'string' ? meta['stepId'] : null);
            const templateName = templateId
                ? templateNames.get(templateId) || `step:${templateId.slice(0, 8)}`
                : 'manual';
            const industry = toIndustryLabel(message.lead.industry);
            const key = `${message.type}|${templateId || 'manual'}|${industry}`;

            if (!buckets.has(key)) {
                buckets.set(key, {
                    channel: message.type,
                    templateId,
                    templateName,
                    industry,
                    sent: 0,
                    opened: 0,
                    replied: 0,
                    bounced: 0,
                });
            }

            const bucket = buckets.get(key)!;
            bucket.sent += 1;

            if (OPENED_MESSAGE_STATUSES.has(message.status)) {
                bucket.opened += 1;
            }
            if (message.status === 'REPLIED') {
                bucket.replied += 1;
            }
            if (message.status === 'BOUNCED') {
                bucket.bounced += 1;
            }
        }

        const items = Array.from(buckets.values())
            .map((bucket) => ({
                ...bucket,
                openRate: toRate(bucket.opened, bucket.sent),
                replyRate: toRate(bucket.replied, bucket.sent),
                bounceRate: toRate(bucket.bounced, bucket.sent),
            }))
            .sort((a, b) => {
                if (b.replyRate !== a.replyRate) {
                    return b.replyRate - a.replyRate;
                }
                return b.sent - a.sent;
            });

        return {
            items,
            windowDays: days,
            totalMessages: messages.length,
        };
    },

    async getTimingHeatmap(
        organizationId: string,
        days = DEFAULT_TIMING_HEATMAP_DAYS
    ) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const messages = await prisma.message.findMany({
            where: {
                direction: 'OUTBOUND',
                lead: { organizationId },
                sentAt: { gte: since },
            },
            select: {
                sentAt: true,
                status: true,
                lead: {
                    select: {
                        industry: true,
                    },
                },
            },
        });

        const buckets = new Map<
            string,
            {
                industry: string;
                hour: number;
                sent: number;
                opened: number;
                replied: number;
            }
        >();
        const volumePerIndustry = new Map<string, number>();

        for (const message of messages) {
            if (!message.sentAt) {
                continue;
            }

            const industry = toIndustryLabel(message.lead.industry);
            const hour = message.sentAt.getHours();
            const key = `${industry}|${hour}`;

            if (!buckets.has(key)) {
                buckets.set(key, {
                    industry,
                    hour,
                    sent: 0,
                    opened: 0,
                    replied: 0,
                });
            }

            const bucket = buckets.get(key)!;
            bucket.sent += 1;
            volumePerIndustry.set(industry, (volumePerIndustry.get(industry) || 0) + 1);

            if (OPENED_MESSAGE_STATUSES.has(message.status)) {
                bucket.opened += 1;
            }
            if (message.status === 'REPLIED') {
                bucket.replied += 1;
            }
        }

        const industries = Array.from(volumePerIndustry.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([industry]) => industry)
            .slice(0, 8);

        const hours = Array.from({ length: 24 }, (_, index) => index);
        const baseCells = Array.from(buckets.values())
            .filter((cell) => industries.includes(cell.industry))
            .map((cell) => ({
                ...cell,
                openRate: toRate(cell.opened, cell.sent),
                replyRate: toRate(cell.replied, cell.sent),
            }));

        const maxSent = baseCells.reduce((max, cell) => Math.max(max, cell.sent), 0);
        const cells = baseCells.map((cell) => {
            const volumeScore =
                maxSent > 0 ? Number((Math.sqrt(cell.sent / maxSent) * 100).toFixed(2)) : 0;
            const weightedScore = Number(
                (
                    cell.replyRate * TIMING_HEATMAP_WEIGHTS.replyRate +
                    cell.openRate * TIMING_HEATMAP_WEIGHTS.openRate +
                    volumeScore * TIMING_HEATMAP_WEIGHTS.volume
                ).toFixed(2)
            );
            return {
                ...cell,
                volumeScore,
                weightedScore,
            };
        });

        const bestWindows = [...cells]
            .sort((a, b) => {
                if (b.weightedScore !== a.weightedScore) {
                    return b.weightedScore - a.weightedScore;
                }
                if (b.replyRate !== a.replyRate) {
                    return b.replyRate - a.replyRate;
                }
                return b.sent - a.sent;
            })
            .slice(0, 8);

        return {
            windowDays: days,
            industries,
            hours,
            cells,
            bestWindows,
            weights: TIMING_HEATMAP_WEIGHTS,
        };
    },

    async getResponseTime(organizationId: string, days = DEFAULT_RESPONSE_TIME_DAYS) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const messages = await prisma.message.findMany({
            where: {
                direction: 'OUTBOUND',
                lead: { organizationId },
                repliedAt: { not: null },
                createdAt: { gte: since },
            },
            select: {
                type: true,
                responseTime: true,
                sentAt: true,
                repliedAt: true,
                createdAt: true,
                lead: {
                    select: {
                        source: true,
                    },
                },
            },
        });

        const allTimes: number[] = [];
        const byChannel = new Map<string, number[]>();
        const bySource = new Map<string, number[]>();

        for (const message of messages) {
            const seconds = messageResponseTimeSeconds(message);
            if (seconds === null) {
                continue;
            }

            allTimes.push(seconds);

            const channelKey = message.type;
            if (!byChannel.has(channelKey)) {
                byChannel.set(channelKey, []);
            }
            byChannel.get(channelKey)!.push(seconds);

            const sourceKey = toSourceLabel(message.lead.source);
            if (!bySource.has(sourceKey)) {
                bySource.set(sourceKey, []);
            }
            bySource.get(sourceKey)!.push(seconds);
        }

        const channelStats = Array.from(byChannel.entries())
            .map(([channel, values]) => ({
                channel,
                ...summarizeResponseTimes(values),
            }))
            .sort((a, b) => a.avgSeconds - b.avgSeconds);

        const sourceStats = Array.from(bySource.entries())
            .map(([source, values]) => ({
                source,
                ...summarizeResponseTimes(values),
            }))
            .sort((a, b) => a.avgSeconds - b.avgSeconds)
            .slice(0, 10);

        return {
            windowDays: days,
            summary: summarizeResponseTimes(allTimes),
            byChannel: channelStats,
            bySource: sourceStats,
        };
    },

    async getScoreCorrelation(organizationId: string) {
        const leads = await prisma.lead.findMany({
            where: { organizationId },
            select: {
                score: true,
                status: true,
                _count: {
                    select: {
                        messages: {
                            where: { direction: 'OUTBOUND' },
                        },
                    },
                },
            },
        });

        const buckets = [
            { key: '0-39', min: 0, max: 39 },
            { key: '40-69', min: 40, max: 69 },
            { key: '70-100', min: 70, max: 100 },
            { key: 'unscored', min: null, max: null },
        ] as const;

        const data = buckets.map((bucket) => ({
            bucket: bucket.key,
            totalLeads: 0,
            contactedLeads: 0,
            repliedLeads: 0,
            convertedLeads: 0,
        }));

        for (const lead of leads) {
            const score = lead.score;
            const bucketIndex =
                typeof score === 'number'
                    ? data.findIndex((item) => {
                          if (item.bucket === 'unscored') {
                              return false;
                          }
                          const [min, max] = item.bucket.split('-').map((value) => Number(value));
                          return score >= min && score <= max;
                      })
                    : data.findIndex((item) => item.bucket === 'unscored');

            const target = data[bucketIndex >= 0 ? bucketIndex : data.length - 1];
            target.totalLeads += 1;

            const contacted = isLeadContacted(lead.status, lead._count.messages);
            const replied = isLeadReplied(lead.status, 0);
            const converted = lead.status === 'CONVERTED';

            if (contacted) {
                target.contactedLeads += 1;
            }
            if (replied) {
                target.repliedLeads += 1;
            }
            if (converted) {
                target.convertedLeads += 1;
            }
        }

        const items = data.map((bucket) => ({
            ...bucket,
            replyRate: toRate(bucket.repliedLeads, bucket.contactedLeads),
            conversionRate: toRate(bucket.convertedLeads, bucket.contactedLeads),
        }));

        return { items };
    },

    async getFunnel(organizationId: string) {
        const captured = await prisma.lead.count({
            where: { organizationId },
        });

        const enriched = await prisma.lead.count({
            where: {
                organizationId,
                OR: [
                    { enrichedAt: { not: null } },
                    { score: { not: null } },
                    { icpMatch: { not: null } },
                ],
            },
        });

        const contacted = await prisma.lead.count({
            where: {
                organizationId,
                OR: [
                    { status: { in: Array.from(CONTACTED_STATUSES) } },
                    { messages: { some: { direction: 'OUTBOUND' } } },
                ],
            },
        });

        const replied = await prisma.lead.count({
            where: {
                organizationId,
                OR: [
                    { status: { in: Array.from(REPLIED_STATUSES) } },
                    { messages: { some: { direction: 'INBOUND' } } },
                ],
            },
        });

        const converted = await prisma.lead.count({
            where: {
                organizationId,
                status: 'CONVERTED',
            },
        });

        const stagesRaw = [
            { id: 'captured', label: 'Capturados', value: captured },
            { id: 'enriched', label: 'Enriquecidos', value: enriched },
            { id: 'contacted', label: 'Contatados', value: contacted },
            { id: 'replied', label: 'Responderam', value: replied },
            { id: 'converted', label: 'Convertidos', value: converted },
        ];

        const stages = stagesRaw.map((stage, index) => {
            const previous = index > 0 ? stagesRaw[index - 1].value : stage.value;
            return {
                ...stage,
                pctOfCaptured: toRate(stage.value, captured),
                pctFromPrevious: toRate(stage.value, previous),
            };
        });

        return { stages };
    },

    async recomputeCampaignMetrics(organizationId?: string, campaignId?: string) {
        const where: Prisma.CampaignWhereInput = {
            ...(organizationId ? { organizationId } : {}),
            ...(campaignId ? { id: campaignId } : {}),
        };

        const campaigns = await prisma.campaign.findMany({
            where,
            select: {
                id: true,
                organizationId: true,
                steps: {
                    select: { id: true },
                },
            },
        });

        let updated = 0;
        const calculatedAt = new Date();

        for (const campaign of campaigns) {
            const metrics = await calculateCampaignMetrics(campaign);
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: {
                    metrics: metrics as unknown as Prisma.InputJsonValue,
                    lastMetricsAt: calculatedAt,
                },
            });
            updated += 1;
        }

        return {
            scanned: campaigns.length,
            updated,
            calculatedAt: calculatedAt.toISOString(),
        };
    },
};

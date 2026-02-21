import {
    MessageStatus,
    MessageType,
    Plan,
    Prisma,
    SignalChannel,
    SignalEventOutcome,
    SignalEventType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type RecommendationChannel = 'email' | 'whatsapp';
type AlertSeverity = 'low' | 'medium' | 'high';
type CohortTier = 'beta' | 'early' | 'scale';
type BillingTier = 'Starter' | 'Growth' | 'Scale';

interface TrackSignalEventInput {
    organizationId: string;
    eventType: SignalEventType;
    channel: SignalChannel;
    outcome: SignalEventOutcome;
    leadId?: string | null;
    campaignId?: string | null;
    leadSegment?: string | null;
    eventAt?: Date;
    dedupeKey: string;
    metadata?: Prisma.InputJsonValue;
}

interface ChannelPerformance {
    sent: number;
    replied: number;
    bounced: number;
    failed: number;
    replyRate: number;
    bounceRate: number;
}

interface SegmentStats {
    email: ChannelPerformance;
    whatsapp: ChannelPerformance;
    totalSent: number;
    totalReplied: number;
}

interface BestWindow {
    dayOfWeek: string;
    hour: number;
    timezone: string;
    confidence: number;
}

interface RecommendationResult {
    leadId: string;
    leadSegment: string;
    sharedScore: number;
    recommendedChannel: RecommendationChannel;
    bestWindow: {
        dayOfWeek: string;
        hour: number;
        timezone: string;
    };
    confidence: number;
    reasons: string[];
    aggregateImpact: {
        segmentReplyRate: number;
        channelReplyRate: number;
        channelBounceRate: number;
    };
}

type LeadForRecommendation = {
    id: string;
    score: number | null;
    email: string | null;
    whatsapp: string | null;
    phone: string | null;
    industry: string | null;
    companySize: string | null;
    jobTitle: string | null;
    seniority: string | null;
    department: string | null;
    country: string | null;
    messages: Array<{
        id: string;
        type: MessageType;
        direction: 'OUTBOUND' | 'INBOUND';
        status: MessageStatus;
        createdAt: Date;
        sentAt: Date | null;
        repliedAt: Date | null;
        bouncedAt: Date | null;
    }>;
};

const NETWORK_LOOKBACK_DAYS = 90;
const IMPACT_LOOKBACK_DAYS = 45;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const PLAN_SIGNAL_FLOOR: Record<Plan, number> = {
    STARTER: 5_000,
    GROWTH: 25_000,
    SCALE: 100_000,
    ENTERPRISE: 250_000,
};

const RECOMMENDATION_EVENT_TYPES: SignalEventType[] = [
    SignalEventType.MESSAGE_SENT,
    SignalEventType.MESSAGE_REPLY_RECEIVED,
    SignalEventType.MESSAGE_BOUNCED,
    SignalEventType.MESSAGE_FAILED,
];

const SIGNAL_MESSAGE_CHANNELS: SignalChannel[] = [SignalChannel.EMAIL, SignalChannel.WHATSAPP];
const OUTBOUND_SENT_SIGNAL_STATUSES: MessageStatus[] = [
    MessageStatus.SENT,
    MessageStatus.DELIVERED,
    MessageStatus.OPENED,
    MessageStatus.CLICKED,
    MessageStatus.REPLIED,
    MessageStatus.BOUNCED,
    MessageStatus.FAILED,
];

function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, value));
}

function normalizeToken(value: string | null | undefined, fallback = 'unknown') {
    if (!value) {
        return fallback;
    }
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function safeNumber(value: number, decimals = 4): number {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
        return 0;
    }
    return Number(value.toFixed(decimals));
}

function daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}

function getMonthStart(date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
}

function toRecommendationChannel(channel: SignalChannel): RecommendationChannel {
    return channel === SignalChannel.WHATSAPP ? 'whatsapp' : 'email';
}

function normalizeWindowParts(date: Date, timezone: string) {
    try {
        const dayOfWeek = new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            timeZone: timezone,
        })
            .format(date)
            .toLowerCase();
        const hour = Number(
            new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                hour12: false,
                timeZone: timezone,
            }).format(date)
        );
        return {
            dayOfWeek,
            hour: Number.isNaN(hour) ? 10 : hour,
        };
    } catch {
        return {
            dayOfWeek: 'tuesday',
            hour: 10,
        };
    }
}

function createZeroPerformance(): ChannelPerformance {
    return {
        sent: 0,
        replied: 0,
        bounced: 0,
        failed: 0,
        replyRate: 0,
        bounceRate: 0,
    };
}

function computeRates(performance: ChannelPerformance): ChannelPerformance {
    const sent = Math.max(performance.sent, 0);
    const replied = Math.max(performance.replied, 0);
    const bounced = Math.max(performance.bounced, 0);
    const failed = Math.max(performance.failed, 0);

    return {
        sent,
        replied,
        bounced,
        failed,
        replyRate: sent > 0 ? safeNumber(replied / sent) : 0,
        bounceRate: sent > 0 ? safeNumber((bounced + failed) / sent) : 0,
    };
}

function buildLeadSegment(lead: {
    industry: string | null;
    companySize: string | null;
    jobTitle: string | null;
    seniority: string | null;
    department: string | null;
    country: string | null;
}) {
    const industry = normalizeToken(lead.industry);
    const size = normalizeToken(lead.companySize, 'unknown_size');
    const role = normalizeToken(lead.jobTitle || lead.seniority || lead.department, 'unknown_role');
    const country = normalizeToken(lead.country, 'unknown_country');
    return `${industry}|${size}|${role}|${country}`;
}

function extractCampaignId(metadata: unknown): string | null {
    const record = asRecord(metadata);
    const raw = record['campaignId'];
    return typeof raw === 'string' ? raw : null;
}

function getDefaultOutcome(eventType: SignalEventType): SignalEventOutcome {
    if (eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
        return SignalEventOutcome.REPLIED;
    }
    if (eventType === SignalEventType.MESSAGE_BOUNCED) {
        return SignalEventOutcome.BOUNCED;
    }
    if (eventType === SignalEventType.MESSAGE_FAILED) {
        return SignalEventOutcome.FAILED;
    }
    if (eventType === SignalEventType.MANUAL_TOUCHPOINT_CREATED) {
        return SignalEventOutcome.MANUAL;
    }
    return SignalEventOutcome.SENT;
}

function mapMessageTypeToSignalChannel(type: MessageType): SignalChannel {
    return type === MessageType.WHATSAPP ? SignalChannel.WHATSAPP : SignalChannel.EMAIL;
}

function tierFromUsage(signalsUsed: number): BillingTier {
    if (signalsUsed > 25_000) {
        return 'Scale';
    }
    if (signalsUsed > 5_000) {
        return 'Growth';
    }
    return 'Starter';
}

function cohortFromUsage(signalsUsed: number): CohortTier {
    if (signalsUsed > 25_000) {
        return 'scale';
    }
    if (signalsUsed > 5_000) {
        return 'early';
    }
    return 'beta';
}

function getMessageEventTimestamp(
    message: {
        createdAt: Date;
        sentAt: Date | null;
        repliedAt: Date | null;
        bouncedAt: Date | null;
    },
    eventType: SignalEventType
) {
    if (eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
        return message.repliedAt || message.createdAt;
    }
    if (eventType === SignalEventType.MESSAGE_BOUNCED) {
        return message.bouncedAt || message.createdAt;
    }
    if (eventType === SignalEventType.MESSAGE_SENT) {
        return message.sentAt || message.createdAt;
    }
    return message.createdAt;
}

function summarizeLeadHistory(messages: LeadForRecommendation['messages']) {
    const summary = {
        email: { outbound: 0, replied: 0, bounced: 0 },
        whatsapp: { outbound: 0, replied: 0, bounced: 0 },
        lastInboundAt: null as Date | null,
        lastOutboundAt: null as Date | null,
    };

    for (const message of messages) {
        const key = message.type === MessageType.WHATSAPP ? 'whatsapp' : 'email';
        if (message.direction === 'OUTBOUND') {
            summary[key].outbound += 1;
            const outboundAt = message.sentAt || message.createdAt;
            if (!summary.lastOutboundAt || outboundAt > summary.lastOutboundAt) {
                summary.lastOutboundAt = outboundAt;
            }
            if (message.status === MessageStatus.REPLIED || message.repliedAt) {
                summary[key].replied += 1;
            }
            if (message.status === MessageStatus.BOUNCED || message.status === MessageStatus.FAILED) {
                summary[key].bounced += 1;
            }
        }
        if (message.direction === 'INBOUND') {
            const inboundAt = message.repliedAt || message.createdAt;
            if (!summary.lastInboundAt || inboundAt > summary.lastInboundAt) {
                summary.lastInboundAt = inboundAt;
            }
            summary[key].replied += 1;
        }
    }

    return summary;
}

export class SignalLayerService {
    async trackEvent(input: TrackSignalEventInput): Promise<boolean> {
        let leadSegment = input.leadSegment ?? null;
        if (!leadSegment && input.leadId) {
            const lead = await prisma.lead.findFirst({
                where: {
                    id: input.leadId,
                    organizationId: input.organizationId,
                },
                select: {
                    industry: true,
                    companySize: true,
                    jobTitle: true,
                    seniority: true,
                    department: true,
                    country: true,
                },
            });
            if (lead) {
                leadSegment = buildLeadSegment(lead);
            }
        }

        try {
            await prisma.signalEvent.create({
                data: {
                    dedupeKey: input.dedupeKey,
                    organizationId: input.organizationId,
                    leadId: input.leadId ?? undefined,
                    campaignId: input.campaignId ?? undefined,
                    eventType: input.eventType,
                    channel: input.channel,
                    outcome: input.outcome,
                    leadSegment: leadSegment || undefined,
                    eventAt: input.eventAt || new Date(),
                    metadata: input.metadata,
                },
            });
            return true;
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                return false;
            }
            throw error;
        }
    }

    async trackMessageEvent(input: {
        messageId: string;
        eventType: SignalEventType;
        eventAt?: Date;
        metadata?: Prisma.InputJsonValue;
        dedupeSuffix?: string;
    }): Promise<boolean> {
        const message = await prisma.message.findUnique({
            where: { id: input.messageId },
            select: {
                id: true,
                type: true,
                createdAt: true,
                sentAt: true,
                repliedAt: true,
                bouncedAt: true,
                metadata: true,
                leadId: true,
                lead: {
                    select: {
                        organizationId: true,
                        industry: true,
                        companySize: true,
                        jobTitle: true,
                        seniority: true,
                        department: true,
                        country: true,
                    },
                },
            },
        });

        if (!message?.lead) {
            return false;
        }

        const messageMetadata = asRecord(message.metadata);
        const campaignId = extractCampaignId(messageMetadata);
        const dedupeSuffix = input.dedupeSuffix ? `:${input.dedupeSuffix}` : '';
        const dedupeKey = `${input.eventType}:${message.id}${dedupeSuffix}`;
        const leadSegment = buildLeadSegment(message.lead);

        return this.trackEvent({
            organizationId: message.lead.organizationId,
            leadId: message.leadId,
            campaignId,
            eventType: input.eventType,
            channel: mapMessageTypeToSignalChannel(message.type),
            outcome: getDefaultOutcome(input.eventType),
            leadSegment,
            dedupeKey,
            eventAt: input.eventAt || getMessageEventTimestamp(message, input.eventType),
            metadata:
                input.metadata ||
                ({
                    source: 'message_lifecycle',
                    messageId: message.id,
                } satisfies Prisma.InputJsonValue),
        });
    }

    async trackMessageFailure(messageId: string, reason?: string): Promise<boolean> {
        return this.trackMessageEvent({
            messageId,
            eventType: SignalEventType.MESSAGE_FAILED,
            metadata: {
                source: 'worker_failure',
                reason: reason || 'unknown',
            } satisfies Prisma.InputJsonValue,
        });
    }

    async trackManualTouchpoint(input: {
        organizationId: string;
        leadId: string;
        channel: 'EMAIL' | 'WHATSAPP';
        messageId?: string;
        campaignId?: string | null;
        metadata?: Prisma.InputJsonValue;
    }): Promise<boolean> {
        const dedupeKey = input.messageId
            ? `${SignalEventType.MANUAL_TOUCHPOINT_CREATED}:${input.messageId}`
            : `${SignalEventType.MANUAL_TOUCHPOINT_CREATED}:${input.organizationId}:${input.leadId}:${Date.now()}`;
        return this.trackEvent({
            organizationId: input.organizationId,
            leadId: input.leadId,
            campaignId: input.campaignId ?? undefined,
            eventType: SignalEventType.MANUAL_TOUCHPOINT_CREATED,
            channel: input.channel === 'WHATSAPP' ? SignalChannel.WHATSAPP : SignalChannel.EMAIL,
            outcome: SignalEventOutcome.MANUAL,
            dedupeKey,
            metadata: input.metadata,
        });
    }

    private async getSegmentStats(
        segment: string | null,
        cache?: Map<string, Promise<SegmentStats>>
    ): Promise<SegmentStats> {
        const key = segment || '__network__';
        if (cache?.has(key)) {
            return (await cache.get(key)) as SegmentStats;
        }

        const loader = (async () => {
            const rows = await prisma.signalEvent.groupBy({
                by: ['channel', 'eventType'],
                where: {
                    AND: [
                        {
                            eventAt: {
                                gte: daysAgo(NETWORK_LOOKBACK_DAYS),
                            },
                        },
                        {
                            channel: {
                                in: SIGNAL_MESSAGE_CHANNELS,
                            },
                        },
                        {
                            eventType: {
                                in: RECOMMENDATION_EVENT_TYPES,
                            },
                        },
                        segment ? { leadSegment: segment } : {},
                    ],
                },
                _count: { _all: true },
            });

            const email = createZeroPerformance();
            const whatsapp = createZeroPerformance();

            for (const row of rows) {
                const target = row.channel === SignalChannel.WHATSAPP ? whatsapp : email;
                if (row.eventType === SignalEventType.MESSAGE_SENT) {
                    target.sent += row._count._all;
                } else if (row.eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
                    target.replied += row._count._all;
                } else if (row.eventType === SignalEventType.MESSAGE_BOUNCED) {
                    target.bounced += row._count._all;
                } else if (row.eventType === SignalEventType.MESSAGE_FAILED) {
                    target.failed += row._count._all;
                }
            }

            const emailComputed = computeRates(email);
            const whatsappComputed = computeRates(whatsapp);
            return {
                email: emailComputed,
                whatsapp: whatsappComputed,
                totalSent: emailComputed.sent + whatsappComputed.sent,
                totalReplied: emailComputed.replied + whatsappComputed.replied,
            };
        })();

        cache?.set(key, loader);
        return loader;
    }

    private async getBestWindow(
        segment: string | null,
        timezone: string,
        cache?: Map<string, Promise<BestWindow>>
    ): Promise<BestWindow> {
        const key = `${segment || '__network__'}:${timezone}`;
        if (cache?.has(key)) {
            return (await cache.get(key)) as BestWindow;
        }

        const loader = (async () => {
            const events = await prisma.signalEvent.findMany({
                where: {
                    AND: [
                        {
                            eventAt: {
                                gte: daysAgo(NETWORK_LOOKBACK_DAYS),
                            },
                        },
                        {
                            eventType: {
                                in: [
                                    SignalEventType.MESSAGE_SENT,
                                    SignalEventType.MESSAGE_REPLY_RECEIVED,
                                ],
                            },
                        },
                        {
                            channel: {
                                in: SIGNAL_MESSAGE_CHANNELS,
                            },
                        },
                        segment ? { leadSegment: segment } : {},
                    ],
                },
                select: {
                    eventType: true,
                    eventAt: true,
                },
                take: 10_000,
            });

            const buckets = new Map<string, { sent: number; replied: number }>();
            for (const event of events) {
                const parts = normalizeWindowParts(event.eventAt, timezone);
                const bucketKey = `${parts.dayOfWeek}:${parts.hour}`;
                const current = buckets.get(bucketKey) || { sent: 0, replied: 0 };
                if (event.eventType === SignalEventType.MESSAGE_SENT) {
                    current.sent += 1;
                }
                if (event.eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
                    current.replied += 1;
                }
                buckets.set(bucketKey, current);
            }

            let best: { key: string; score: number; sent: number } | null = null;
            for (const [bucketKey, values] of buckets) {
                if (values.sent < 2) {
                    continue;
                }
                const replyRate = values.replied / values.sent;
                const volumeBoost = Math.min(values.sent, 40) / 100;
                const score = replyRate + volumeBoost;
                if (!best || score > best.score) {
                    best = {
                        key: bucketKey,
                        score,
                        sent: values.sent,
                    };
                }
            }

            if (!best) {
                return {
                    dayOfWeek: 'tuesday',
                    hour: 10,
                    timezone,
                    confidence: 0.35,
                };
            }

            const [dayOfWeek, hour] = best.key.split(':');
            const hourNumber = Number(hour);
            return {
                dayOfWeek,
                hour: Number.isNaN(hourNumber) ? 10 : hourNumber,
                timezone,
                confidence: clamp(0.35 + best.sent / 200, 0.35, 0.95),
            };
        })();

        cache?.set(key, loader);
        return loader;
    }

    private chooseChannel(
        lead: LeadForRecommendation,
        stats: SegmentStats,
        history: ReturnType<typeof summarizeLeadHistory>
    ): RecommendationChannel {
        const emailHistoryRate =
            history.email.outbound > 0 ? history.email.replied / history.email.outbound : 0;
        const whatsappHistoryRate =
            history.whatsapp.outbound > 0
                ? history.whatsapp.replied / history.whatsapp.outbound
                : 0;

        let emailScore =
            stats.email.replyRate * 0.75 + emailHistoryRate * 0.25 - stats.email.bounceRate * 0.4;
        let whatsappScore =
            stats.whatsapp.replyRate * 0.75 +
            whatsappHistoryRate * 0.25 -
            stats.whatsapp.bounceRate * 0.25;

        if (!lead.email) {
            emailScore = -1;
        }
        if (!lead.whatsapp && !lead.phone) {
            whatsappScore = -1;
        }

        if (whatsappScore > emailScore) {
            return 'whatsapp';
        }
        return 'email';
    }

    private async buildRecommendation(
        lead: LeadForRecommendation,
        statsCache?: Map<string, Promise<SegmentStats>>,
        windowCache?: Map<string, Promise<BestWindow>>
    ): Promise<RecommendationResult> {
        const leadSegment = buildLeadSegment(lead);
        const [segmentStats, networkStats, bestWindow] = await Promise.all([
            this.getSegmentStats(leadSegment, statsCache),
            this.getSegmentStats(null, statsCache),
            this.getBestWindow(leadSegment, DEFAULT_TIMEZONE, windowCache),
        ]);

        const activeStats = segmentStats.totalSent >= 12 ? segmentStats : networkStats;
        const history = summarizeLeadHistory(lead.messages);
        const recommendedChannel = this.chooseChannel(lead, activeStats, history);
        const chosenStats =
            recommendedChannel === 'whatsapp' ? activeStats.whatsapp : activeStats.email;

        const now = new Date();
        const lastInboundDays = history.lastInboundAt
            ? (now.getTime() - history.lastInboundAt.getTime()) / (1000 * 60 * 60 * 24)
            : Number.POSITIVE_INFINITY;
        const recencyBoost =
            lastInboundDays <= 3 ? 12 : lastInboundDays <= 7 ? 7 : lastInboundDays <= 14 ? 3 : 0;

        const baseScore = lead.score ?? 50;
        const sharedScore = clamp(
            Math.round(
                baseScore * 0.58 +
                    chosenStats.replyRate * 30 +
                    bestWindow.confidence * 8 +
                    recencyBoost -
                    chosenStats.bounceRate * 18
            ),
            0,
            100
        );

        const confidence = clamp(
            0.2 + activeStats.totalSent / 250 + (history.email.outbound + history.whatsapp.outbound) / 100,
            0.2,
            0.95
        );

        const reasons: string[] = [];
        if (segmentStats.totalSent >= 12) {
            reasons.push('segment_model_confident');
        } else {
            reasons.push('segment_low_sample_using_network');
        }
        reasons.push(
            recommendedChannel === 'whatsapp'
                ? 'channel_whatsapp_higher_reply_rate'
                : 'channel_email_higher_reply_rate'
        );
        if (recencyBoost > 0) {
            reasons.push('recent_inbound_signal_detected');
        }
        if (bestWindow.confidence >= 0.6) {
            reasons.push('timing_window_high_confidence');
        }

        return {
            leadId: lead.id,
            leadSegment,
            sharedScore,
            recommendedChannel,
            bestWindow: {
                dayOfWeek: bestWindow.dayOfWeek,
                hour: bestWindow.hour,
                timezone: bestWindow.timezone,
            },
            confidence: safeNumber(confidence, 3),
            reasons,
            aggregateImpact: {
                segmentReplyRate:
                    activeStats.totalSent > 0
                        ? safeNumber(activeStats.totalReplied / activeStats.totalSent)
                        : 0,
                channelReplyRate: chosenStats.replyRate,
                channelBounceRate: chosenStats.bounceRate,
            },
        };
    }

    async getLeadRecommendation(organizationId: string, leadId: string) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            select: {
                id: true,
                score: true,
                email: true,
                whatsapp: true,
                phone: true,
                industry: true,
                companySize: true,
                jobTitle: true,
                seniority: true,
                department: true,
                country: true,
                messages: {
                    select: {
                        id: true,
                        type: true,
                        direction: true,
                        status: true,
                        createdAt: true,
                        sentAt: true,
                        repliedAt: true,
                        bouncedAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                },
            },
        });

        if (!lead) {
            throw new Error('Lead not found');
        }

        return this.buildRecommendation(lead);
    }

    async getLeadRecommendations(organizationId: string, leadIds: string[]) {
        const uniqueLeadIds = Array.from(new Set(leadIds)).slice(0, 200);
        if (uniqueLeadIds.length === 0) {
            return [];
        }

        const leads = await prisma.lead.findMany({
            where: {
                organizationId,
                id: { in: uniqueLeadIds },
            },
            select: {
                id: true,
                score: true,
                email: true,
                whatsapp: true,
                phone: true,
                industry: true,
                companySize: true,
                jobTitle: true,
                seniority: true,
                department: true,
                country: true,
                messages: {
                    select: {
                        id: true,
                        type: true,
                        direction: true,
                        status: true,
                        createdAt: true,
                        sentAt: true,
                        repliedAt: true,
                        bouncedAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 80,
                },
            },
        });

        const statsCache = new Map<string, Promise<SegmentStats>>();
        const windowCache = new Map<string, Promise<BestWindow>>();
        const recommendationMap = new Map<string, RecommendationResult>();

        for (const lead of leads) {
            const recommendation = await this.buildRecommendation(lead, statsCache, windowCache);
            recommendationMap.set(lead.id, recommendation);
        }

        return uniqueLeadIds
            .map((leadId) => recommendationMap.get(leadId))
            .filter((item): item is RecommendationResult => Boolean(item));
    }

    async getCampaignRecommendation(organizationId: string, campaignId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
            select: {
                id: true,
                name: true,
                type: true,
                leads: {
                    select: { leadId: true },
                    take: 300,
                },
            },
        });

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        const leadIds = campaign.leads.map((item) => item.leadId);
        const recommendations = await this.getLeadRecommendations(organizationId, leadIds);

        if (recommendations.length === 0) {
            return {
                campaignId: campaign.id,
                campaignName: campaign.name,
                analyzedLeads: 0,
                averageSharedScore: 0,
                recommendedChannelMix: { email: 0, whatsapp: 0 },
                bestWindow: {
                    dayOfWeek: 'tuesday',
                    hour: 10,
                    timezone: DEFAULT_TIMEZONE,
                },
            };
        }

        const channelMix = recommendations.reduce(
            (acc, item) => {
                if (item.recommendedChannel === 'whatsapp') {
                    acc.whatsapp += 1;
                } else {
                    acc.email += 1;
                }
                return acc;
            },
            { email: 0, whatsapp: 0 }
        );

        const windowCounter = new Map<string, number>();
        for (const recommendation of recommendations) {
            const key = `${recommendation.bestWindow.dayOfWeek}:${recommendation.bestWindow.hour}`;
            windowCounter.set(key, (windowCounter.get(key) || 0) + 1);
        }

        let bestWindowKey = 'tuesday:10';
        let bestWindowCount = 0;
        for (const [key, count] of windowCounter) {
            if (count > bestWindowCount) {
                bestWindowCount = count;
                bestWindowKey = key;
            }
        }
        const [dayOfWeek, hour] = bestWindowKey.split(':');
        const averageSharedScore = Math.round(
            recommendations.reduce((total, item) => total + item.sharedScore, 0) /
                recommendations.length
        );

        const events = await prisma.signalEvent.groupBy({
            by: ['eventType'],
            where: {
                organizationId,
                campaignId,
                eventAt: { gte: daysAgo(IMPACT_LOOKBACK_DAYS) },
                eventType: {
                    in: [
                        SignalEventType.MESSAGE_SENT,
                        SignalEventType.MESSAGE_REPLY_RECEIVED,
                        SignalEventType.MESSAGE_BOUNCED,
                    ],
                },
            },
            _count: { _all: true },
        });

        let sent = 0;
        let replied = 0;
        let bounced = 0;
        for (const row of events) {
            if (row.eventType === SignalEventType.MESSAGE_SENT) {
                sent += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
                replied += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_BOUNCED) {
                bounced += row._count._all;
            }
        }

        return {
            campaignId: campaign.id,
            campaignName: campaign.name,
            analyzedLeads: recommendations.length,
            averageSharedScore,
            recommendedChannelMix: {
                email: safeNumber(channelMix.email / recommendations.length),
                whatsapp: safeNumber(channelMix.whatsapp / recommendations.length),
            },
            bestWindow: {
                dayOfWeek,
                hour: Number(hour),
                timezone: DEFAULT_TIMEZONE,
            },
            aggregateImpact: {
                sent,
                replied,
                bounced,
                replyRate: sent > 0 ? safeNumber(replied / sent) : 0,
                bounceRate: sent > 0 ? safeNumber(bounced / sent) : 0,
            },
        };
    }

    private async getChannelPerformance(where: Prisma.SignalEventWhereInput) {
        const rows = await prisma.signalEvent.groupBy({
            by: ['channel', 'eventType'],
            where: {
                AND: [
                    where,
                    { channel: { in: SIGNAL_MESSAGE_CHANNELS } },
                    { eventType: { in: RECOMMENDATION_EVENT_TYPES } },
                ],
            },
            _count: { _all: true },
        });

        const performance: Record<RecommendationChannel, ChannelPerformance> = {
            email: createZeroPerformance(),
            whatsapp: createZeroPerformance(),
        };

        for (const row of rows) {
            const key = toRecommendationChannel(row.channel);
            if (row.eventType === SignalEventType.MESSAGE_SENT) {
                performance[key].sent += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
                performance[key].replied += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_BOUNCED) {
                performance[key].bounced += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_FAILED) {
                performance[key].failed += row._count._all;
            }
        }

        return {
            email: computeRates(performance.email),
            whatsapp: computeRates(performance.whatsapp),
        };
    }

    async getOverview(organizationId: string) {
        const lookbackStart = daysAgo(30);

        const [organizationPerformance, networkPerformance, organizationSignals, networkSignals, segmentCoverage, activeOrgs, bestWindow] =
            await Promise.all([
                this.getChannelPerformance({
                    organizationId,
                    eventAt: { gte: lookbackStart },
                }),
                this.getChannelPerformance({
                    eventAt: { gte: lookbackStart },
                }),
                prisma.signalEvent.count({
                    where: {
                        organizationId,
                        eventAt: { gte: lookbackStart },
                    },
                }),
                prisma.signalEvent.count({
                    where: { eventAt: { gte: lookbackStart } },
                }),
                prisma.signalEvent.groupBy({
                    by: ['leadSegment'],
                    where: {
                        organizationId,
                        leadSegment: { not: null },
                        eventAt: { gte: lookbackStart },
                    },
                }),
                prisma.signalEvent.groupBy({
                    by: ['organizationId'],
                    where: {
                        eventAt: { gte: lookbackStart },
                    },
                }),
                this.getBestWindow(null, DEFAULT_TIMEZONE),
            ]);

        const orgTopChannel =
            organizationPerformance.whatsapp.replyRate > organizationPerformance.email.replyRate
                ? 'whatsapp'
                : 'email';
        const networkTopChannel =
            networkPerformance.whatsapp.replyRate > networkPerformance.email.replyRate
                ? 'whatsapp'
                : 'email';

        return {
            windowDays: 30,
            generatedAt: new Date().toISOString(),
            organization: {
                signals: organizationSignals,
                topChannel: orgTopChannel,
                channelPerformance: organizationPerformance,
                segmentCoverage: segmentCoverage.length,
            },
            network: {
                signals: networkSignals,
                activeOrganizations: activeOrgs.length,
                topChannel: networkTopChannel,
                channelPerformance: networkPerformance,
                bestWindow,
            },
        };
    }

    async getActionableAlerts(organizationId: string) {
        const now = new Date();
        const alerts: Array<{
            id: string;
            type: string;
            severity: AlertSeverity;
            title: string;
            description: string;
            recommendedAction: string;
            leadId?: string;
            createdAt: string;
        }> = [];

        const hotReplies = await prisma.signalEvent.findMany({
            where: {
                organizationId,
                eventType: SignalEventType.MESSAGE_REPLY_RECEIVED,
                leadId: { not: null },
                eventAt: { gte: daysAgo(3) },
            },
            select: {
                id: true,
                leadId: true,
                channel: true,
                eventAt: true,
                lead: {
                    select: {
                        fullName: true,
                        companyName: true,
                    },
                },
            },
            orderBy: {
                eventAt: 'desc',
            },
            take: 4,
        });

        for (const event of hotReplies) {
            const leadName = event.lead?.fullName || 'Lead';
            const company = event.lead?.companyName ? ` (${event.lead.companyName})` : '';
            alerts.push({
                id: `hot_reply_${event.id}`,
                type: 'HOT_REPLY',
                severity: 'high',
                title: `Resposta quente de ${leadName}${company}`,
                description: `Reply recente via ${toRecommendationChannel(event.channel)}.`,
                recommendedAction: 'Responder em ate 2 horas para aumentar conversao.',
                leadId: event.leadId || undefined,
                createdAt: event.eventAt.toISOString(),
            });
        }

        const orgPerformance = await this.getChannelPerformance({
            organizationId,
            eventAt: { gte: daysAgo(21) },
        });
        const networkPerformance = await this.getChannelPerformance({
            eventAt: { gte: daysAgo(21) },
        });

        const emailLift = networkPerformance.email.replyRate - orgPerformance.email.replyRate;
        const whatsappLift =
            networkPerformance.whatsapp.replyRate - orgPerformance.whatsapp.replyRate;

        if (emailLift > 0.05) {
            alerts.push({
                id: 'channel_shift_email',
                type: 'CHANNEL_SHIFT',
                severity: 'medium',
                title: 'Oportunidade de ajuste para Email',
                description: `A rede esta com ${(networkPerformance.email.replyRate * 100).toFixed(1)}% de reply em Email.`,
                recommendedAction: 'Aumentar volume de Email para segmentos prioritarios.',
                createdAt: now.toISOString(),
            });
        }
        if (whatsappLift > 0.05) {
            alerts.push({
                id: 'channel_shift_whatsapp',
                type: 'CHANNEL_SHIFT',
                severity: 'medium',
                title: 'Oportunidade de ajuste para WhatsApp',
                description: `A rede esta com ${(networkPerformance.whatsapp.replyRate * 100).toFixed(1)}% de reply em WhatsApp.`,
                recommendedAction: 'Direcionar proximas sequencias para WhatsApp onde houver telefone valido.',
                createdAt: now.toISOString(),
            });
        }

        const bounceSegments = await prisma.signalEvent.groupBy({
            by: ['leadSegment', 'eventType'],
            where: {
                eventAt: { gte: daysAgo(14) },
                leadSegment: { not: null },
                eventType: {
                    in: [SignalEventType.MESSAGE_SENT, SignalEventType.MESSAGE_BOUNCED],
                },
            },
            _count: { _all: true },
        });

        const bounceMap = new Map<string, { sent: number; bounced: number }>();
        for (const row of bounceSegments) {
            if (!row.leadSegment) {
                continue;
            }
            const current = bounceMap.get(row.leadSegment) || { sent: 0, bounced: 0 };
            if (row.eventType === SignalEventType.MESSAGE_SENT) {
                current.sent += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_BOUNCED) {
                current.bounced += row._count._all;
            }
            bounceMap.set(row.leadSegment, current);
        }

        for (const [segment, values] of bounceMap) {
            if (values.sent < 20) {
                continue;
            }
            const bounceRate = values.bounced / values.sent;
            if (bounceRate > 0.15) {
                alerts.push({
                    id: `bounce_risk_${segment}`,
                    type: 'BOUNCE_RISK',
                    severity: 'medium',
                    title: 'Risco elevado de bounce em segmento',
                    description: `Segmento ${segment} com bounce de ${(bounceRate * 100).toFixed(1)}%.`,
                    recommendedAction:
                        'Validar contatos antes do envio e reduzir cadencia no segmento.',
                    createdAt: now.toISOString(),
                });
            }
        }

        return alerts.slice(0, 12);
    }

    async getImpact(organizationId: string) {
        const lookbackStart = daysAgo(IMPACT_LOOKBACK_DAYS);

        const [orgPerf, networkPerf, orgSegments] = await Promise.all([
            this.getChannelPerformance({
                organizationId,
                eventAt: { gte: lookbackStart },
            }),
            this.getChannelPerformance({
                eventAt: { gte: lookbackStart },
            }),
            prisma.signalEvent.groupBy({
                by: ['leadSegment', 'eventType'],
                where: {
                    organizationId,
                    eventAt: { gte: lookbackStart },
                    leadSegment: { not: null },
                    eventType: {
                        in: [
                            SignalEventType.MESSAGE_SENT,
                            SignalEventType.MESSAGE_REPLY_RECEIVED,
                            SignalEventType.MESSAGE_BOUNCED,
                        ],
                    },
                },
                _count: { _all: true },
            }),
        ]);

        const byChannel = (['email', 'whatsapp'] as RecommendationChannel[]).map((channel) => {
            const org = orgPerf[channel];
            const network = networkPerf[channel];
            return {
                channel,
                organizationReplyRate: org.replyRate,
                networkReplyRate: network.replyRate,
                organizationBounceRate: org.bounceRate,
                lift: safeNumber(network.replyRate - org.replyRate),
            };
        });

        const segmentMap = new Map<string, { sent: number; replied: number; bounced: number }>();
        for (const row of orgSegments) {
            if (!row.leadSegment) {
                continue;
            }
            const current = segmentMap.get(row.leadSegment) || { sent: 0, replied: 0, bounced: 0 };
            if (row.eventType === SignalEventType.MESSAGE_SENT) {
                current.sent += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
                current.replied += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_BOUNCED) {
                current.bounced += row._count._all;
            }
            segmentMap.set(row.leadSegment, current);
        }

        const sortedSegments = Array.from(segmentMap.entries())
            .sort((a, b) => b[1].sent - a[1].sent)
            .slice(0, 6);

        const networkStatsCache = new Map<string, Promise<SegmentStats>>();
        const bySegment = [] as Array<{
            segment: string;
            sent: number;
            organizationReplyRate: number;
            networkReplyRate: number;
            organizationBounceRate: number;
            lift: number;
        }>;

        for (const [segment, values] of sortedSegments) {
            const networkStats = await this.getSegmentStats(segment, networkStatsCache);
            const networkReplyRate =
                networkStats.totalSent > 0
                    ? safeNumber(networkStats.totalReplied / networkStats.totalSent)
                    : 0;
            const organizationReplyRate = values.sent > 0 ? safeNumber(values.replied / values.sent) : 0;
            const organizationBounceRate =
                values.sent > 0 ? safeNumber(values.bounced / values.sent) : 0;
            bySegment.push({
                segment,
                sent: values.sent,
                organizationReplyRate,
                networkReplyRate,
                organizationBounceRate,
                lift: safeNumber(networkReplyRate - organizationReplyRate),
            });
        }

        const overallLift = safeNumber(
            ((networkPerf.email.replyRate + networkPerf.whatsapp.replyRate) / 2 -
                (orgPerf.email.replyRate + orgPerf.whatsapp.replyRate) / 2) *
                100
        );

        return {
            windowDays: IMPACT_LOOKBACK_DAYS,
            generatedAt: new Date().toISOString(),
            summary: {
                overallLift,
                topOpportunityChannel:
                    networkPerf.whatsapp.replyRate - orgPerf.whatsapp.replyRate >
                    networkPerf.email.replyRate - orgPerf.email.replyRate
                        ? 'whatsapp'
                        : 'email',
            },
            byChannel,
            bySegment,
        };
    }

    async getCohortStatus(organizationId: string) {
        const monthStart = getMonthStart();
        const nextMonth = new Date(
            Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
        );

        const [organization, signalsUsed, byChannel] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: organizationId },
                select: {
                    id: true,
                    plan: true,
                    emailsLimit: true,
                    whatsappLimit: true,
                    enrichmentsLimit: true,
                },
            }),
            prisma.signalEvent.count({
                where: {
                    organizationId,
                    eventAt: {
                        gte: monthStart,
                        lt: nextMonth,
                    },
                },
            }),
            prisma.signalEvent.groupBy({
                by: ['channel'],
                where: {
                    organizationId,
                    eventAt: {
                        gte: monthStart,
                        lt: nextMonth,
                    },
                },
                _count: { _all: true },
            }),
        ]);

        if (!organization) {
            throw new Error('Organization not found');
        }

        const baseLimit =
            organization.emailsLimit + organization.whatsappLimit + organization.enrichmentsLimit;
        const monthlyLimit = Math.max(baseLimit, PLAN_SIGNAL_FLOOR[organization.plan]);
        const remaining = Math.max(0, monthlyLimit - signalsUsed);
        const usagePct = monthlyLimit > 0 ? safeNumber((signalsUsed / monthlyLimit) * 100, 2) : 0;

        const cohort = cohortFromUsage(signalsUsed);
        const recommendedTier = tierFromUsage(signalsUsed);

        return {
            cohort,
            currentPlan: organization.plan,
            period: {
                startsAt: monthStart.toISOString(),
                endsAt: nextMonth.toISOString(),
            },
            usage: {
                signalsUsed,
                signalsLimit: monthlyLimit,
                remaining,
                usagePercent: usagePct,
            },
            byChannel: byChannel.map((item) => ({
                channel: toRecommendationChannel(item.channel),
                signals: item._count._all,
            })),
            tierRecommendation: {
                recommendedTier,
                reason:
                    recommendedTier === 'Scale'
                        ? 'Consumo alto de sinais no periodo.'
                        : recommendedTier === 'Growth'
                            ? 'Consumo intermediario acima do nivel Starter.'
                            : 'Consumo dentro da faixa inicial.',
            },
        };
    }

    async backfillSignals(organizationId: string, limit: number) {
        const messages = await prisma.message.findMany({
            where: {
                lead: {
                    organizationId,
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
            select: {
                id: true,
                type: true,
                direction: true,
                status: true,
                createdAt: true,
                sentAt: true,
                repliedAt: true,
                bouncedAt: true,
                leadId: true,
                metadata: true,
            },
        });

        let created = 0;
        for (const message of messages) {
            if (message.direction === 'OUTBOUND') {
                if (OUTBOUND_SENT_SIGNAL_STATUSES.includes(message.status)) {
                    const tracked = await this.trackMessageEvent({
                        messageId: message.id,
                        eventType: SignalEventType.MESSAGE_SENT,
                    });
                    if (tracked) {
                        created += 1;
                    }
                }

                if (message.status === MessageStatus.REPLIED || message.repliedAt) {
                    const tracked = await this.trackMessageEvent({
                        messageId: message.id,
                        eventType: SignalEventType.MESSAGE_REPLY_RECEIVED,
                    });
                    if (tracked) {
                        created += 1;
                    }
                }

                if (message.status === MessageStatus.BOUNCED || message.bouncedAt) {
                    const tracked = await this.trackMessageEvent({
                        messageId: message.id,
                        eventType: SignalEventType.MESSAGE_BOUNCED,
                    });
                    if (tracked) {
                        created += 1;
                    }
                }

                if (message.status === MessageStatus.FAILED) {
                    const tracked = await this.trackMessageEvent({
                        messageId: message.id,
                        eventType: SignalEventType.MESSAGE_FAILED,
                    });
                    if (tracked) {
                        created += 1;
                    }
                }
            }

            if (message.direction === 'INBOUND') {
                const tracked = await this.trackMessageEvent({
                    messageId: message.id,
                    eventType: SignalEventType.MESSAGE_REPLY_RECEIVED,
                });
                if (tracked) {
                    created += 1;
                }
            }
        }

        return {
            scanned: messages.length,
            created,
        };
    }
}

export const signalLayerService = new SignalLayerService();

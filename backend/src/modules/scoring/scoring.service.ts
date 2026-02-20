import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { scoringQueue } from '../../lib/queue.js';
import { LeadTemperatureValue } from './scoring.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TEMPERATURE_ORDER: LeadTemperatureValue[] = ['HOT', 'WARM', 'COLD'];

interface LeaderboardQuery {
    limit: number;
    temperature?: LeadTemperatureValue;
}

interface RecalculateInput {
    leadIds?: string[];
    limit: number;
}

export interface ScoringRecalculateJobData extends RecalculateInput {
    organizationId: string;
}

interface ScoreBreakdown {
    enrichment: number;
    interaction: number;
    timing: number;
    icp: number;
}

type MessageForScoring = {
    type: 'EMAIL' | 'WHATSAPP';
    direction: 'OUTBOUND' | 'INBOUND';
    status:
        | 'PENDING'
        | 'QUEUED'
        | 'SENT'
        | 'DELIVERED'
        | 'OPENED'
        | 'CLICKED'
        | 'REPLIED'
        | 'BOUNCED'
        | 'FAILED';
    createdAt: Date;
    openedAt: Date | null;
    clickedAt: Date | null;
    repliedAt: Date | null;
};

type LeadForScoring = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    email: string | null;
    emailVerified: boolean;
    phone: string | null;
    whatsapp: string | null;
    linkedinUrl: string | null;
    companyName: string | null;
    companyDomain: string | null;
    companyCnpj: string | null;
    companySize: string | null;
    industry: string | null;
    jobTitle: string | null;
    seniority: string | null;
    department: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    icpMatch: number | null;
    messages: MessageForScoring[];
};

type LeaderboardLead = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    companyName: string | null;
    jobTitle: string | null;
    score: number | null;
    temperature: LeadTemperatureValue;
    lastInteraction: Date | null;
    scoreBreakdown: Prisma.JsonValue | null;
    status: string;
};

interface InteractionSignals {
    score: number;
    lastInteraction: Date | null;
    lastReplyAt: Date | null;
    lastOpenAt: Date | null;
    interactionsInLast30: number;
    responseTimesHours: number[];
}

function clampInt(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getDaysSince(date: Date | null, now: Date): number {
    if (!date) {
        return Number.POSITIVE_INFINITY;
    }
    return (now.getTime() - date.getTime()) / DAY_MS;
}

function maxDate(a: Date | null, b: Date | null): Date | null {
    if (!a) {
        return b;
    }
    if (!b) {
        return a;
    }
    return a.getTime() >= b.getTime() ? a : b;
}

function dateWithinDays(date: Date | null, days: number, now: Date): boolean {
    if (!date) {
        return false;
    }
    return now.getTime() - date.getTime() <= days * DAY_MS;
}

function getStringByPath(
    source: Record<string, unknown>,
    path: string
): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (acc && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, source);
}

function extractStringList(value: unknown): string[] {
    if (!value) {
        return [];
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }

    if (Array.isArray(value)) {
        return value.flatMap((entry) => extractStringList(entry));
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const preferredKeys = ['values', 'include', 'options', 'anyOf', 'oneOf', 'value', 'equals', 'match'];
        for (const key of preferredKeys) {
            if (record[key] !== undefined) {
                const list = extractStringList(record[key]);
                if (list.length > 0) {
                    return list;
                }
            }
        }
        return Object.values(record).flatMap((entry) => extractStringList(entry));
    }

    return [];
}

function uniqueNormalized(values: string[]): string[] {
    return Array.from(
        new Set(values.map((value) => value.trim()).filter(Boolean))
    );
}

function hasTextMatch(values: Array<string | null | undefined>, targets: string[]): boolean {
    if (targets.length === 0) {
        return false;
    }

    const normalizedValues = values
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeText(value));
    const normalizedTargets = targets.map((target) => normalizeText(target));

    return normalizedValues.some((value) =>
        normalizedTargets.some((target) => value.includes(target) || target.includes(value))
    );
}

function scoreIcpDimension(
    values: Array<string | null | undefined>,
    targets: string[],
    weight: number
): number {
    if (targets.length === 0) {
        return Math.round(weight * 0.5);
    }
    if (values.every((value) => !value)) {
        return 0;
    }
    return hasTextMatch(values, targets) ? weight : 0;
}

function sortLeaderboardLeads(leads: LeaderboardLead[]): LeaderboardLead[] {
    return [...leads].sort((a, b) => {
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }
        const interactionA = a.lastInteraction?.getTime() ?? 0;
        const interactionB = b.lastInteraction?.getTime() ?? 0;
        return interactionB - interactionA;
    });
}

export class ScoringService {
    private calculateEnrichmentScore(lead: LeadForScoring): number {
        let score = 0;

        if (lead.emailVerified) {
            score += 6;
        }
        if (lead.linkedinUrl) {
            score += 5;
        }
        if (lead.phone || lead.whatsapp) {
            score += 5;
        }

        let companySignals = 0;
        if (lead.companyName) {
            companySignals += 1;
        }
        if (lead.companyDomain || lead.companyCnpj) {
            companySignals += 1;
        }
        if (lead.industry) {
            companySignals += 1;
        }
        if (lead.companySize) {
            companySignals += 1;
        }

        score += Math.round((companySignals / 4) * 9);

        return clampInt(score, 0, 25);
    }

    private calculateInteractionSignals(messages: MessageForScoring[], now: Date): InteractionSignals {
        const eventDates: Date[] = [];
        const responseTimesHours: number[] = [];

        let hasEmailOpen = false;
        let hasEmailClick = false;
        let hasReply = false;
        let hasWhatsAppRead = false;

        let lastReplyAt: Date | null = null;
        let lastOpenAt: Date | null = null;

        const orderedMessages = [...messages].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        let lastOutboundAt: Date | null = null;
        for (const message of orderedMessages) {
            if (message.direction === 'OUTBOUND') {
                lastOutboundAt = message.createdAt;
            } else if (lastOutboundAt) {
                const diffHours =
                    (message.createdAt.getTime() - lastOutboundAt.getTime()) / (60 * 60 * 1000);
                if (diffHours >= 0) {
                    responseTimesHours.push(diffHours);
                }
                lastOutboundAt = null;
            }
        }

        for (const message of messages) {
            if (message.direction === 'INBOUND') {
                eventDates.push(message.createdAt);
                hasReply = true;
                lastReplyAt = maxDate(lastReplyAt, message.createdAt);
                if (message.type === 'WHATSAPP') {
                    hasWhatsAppRead = true;
                    lastOpenAt = maxDate(lastOpenAt, message.createdAt);
                }
            }

            if (message.openedAt) {
                eventDates.push(message.openedAt);
                lastOpenAt = maxDate(lastOpenAt, message.openedAt);
                if (message.type === 'EMAIL') {
                    hasEmailOpen = true;
                }
                if (message.type === 'WHATSAPP') {
                    hasWhatsAppRead = true;
                }
            }

            if (message.clickedAt) {
                eventDates.push(message.clickedAt);
                lastOpenAt = maxDate(lastOpenAt, message.clickedAt);
                if (message.type === 'EMAIL') {
                    hasEmailOpen = true;
                    hasEmailClick = true;
                }
            }

            if (message.repliedAt) {
                eventDates.push(message.repliedAt);
                hasReply = true;
                lastReplyAt = maxDate(lastReplyAt, message.repliedAt);
            }

            if (
                message.type === 'EMAIL' &&
                message.direction === 'OUTBOUND' &&
                (message.status === 'OPENED' ||
                    message.status === 'CLICKED' ||
                    message.status === 'REPLIED')
            ) {
                hasEmailOpen = true;
                lastOpenAt = maxDate(lastOpenAt, message.openedAt ?? message.createdAt);
            }

            if (
                message.type === 'EMAIL' &&
                message.direction === 'OUTBOUND' &&
                (message.status === 'CLICKED' || message.status === 'REPLIED')
            ) {
                hasEmailClick = true;
                lastOpenAt = maxDate(
                    lastOpenAt,
                    message.clickedAt ?? message.openedAt ?? message.createdAt
                );
            }

            if (
                message.type === 'WHATSAPP' &&
                (message.direction === 'INBOUND' ||
                    message.status === 'OPENED' ||
                    message.status === 'REPLIED')
            ) {
                hasWhatsAppRead = true;
                lastOpenAt = maxDate(lastOpenAt, message.openedAt ?? message.createdAt);
            }
        }

        const interactionScore =
            (hasEmailOpen ? 6 : 0) +
            (hasEmailClick ? 8 : 0) +
            (hasReply ? 12 : 0) +
            (hasWhatsAppRead ? 4 : 0);

        const lastInteraction = eventDates.reduce<Date | null>(
            (current, date) => maxDate(current, date),
            null
        );

        const cutoff = now.getTime() - 30 * DAY_MS;
        const interactionsInLast30 = eventDates.filter(
            (date) => date.getTime() >= cutoff
        ).length;

        return {
            score: clampInt(interactionScore, 0, 30),
            lastInteraction,
            lastReplyAt,
            lastOpenAt,
            interactionsInLast30,
            responseTimesHours,
        };
    }

    private calculateTimingScore(signals: InteractionSignals, now: Date): number {
        const daysSinceInteraction = getDaysSince(signals.lastInteraction, now);

        let recency = 0;
        if (daysSinceInteraction <= 1) {
            recency = 10;
        } else if (daysSinceInteraction <= 3) {
            recency = 9;
        } else if (daysSinceInteraction <= 7) {
            recency = 7;
        } else if (daysSinceInteraction <= 14) {
            recency = 4;
        } else if (daysSinceInteraction <= 30) {
            recency = 2;
        }

        let frequency = 0;
        if (signals.interactionsInLast30 >= 10) {
            frequency = 6;
        } else if (signals.interactionsInLast30 >= 6) {
            frequency = 5;
        } else if (signals.interactionsInLast30 >= 3) {
            frequency = 4;
        } else if (signals.interactionsInLast30 >= 1) {
            frequency = 2;
        }

        let responseSpeed = 0;
        if (signals.responseTimesHours.length > 0) {
            const avgResponseHours =
                signals.responseTimesHours.reduce((acc, value) => acc + value, 0) /
                signals.responseTimesHours.length;

            if (avgResponseHours <= 2) {
                responseSpeed = 4;
            } else if (avgResponseHours <= 12) {
                responseSpeed = 3;
            } else if (avgResponseHours <= 48) {
                responseSpeed = 2;
            } else if (avgResponseHours <= 120) {
                responseSpeed = 1;
            }
        }

        return clampInt(recency + frequency + responseSpeed, 0, 20);
    }

    private calculateIcpScore(
        lead: LeadForScoring,
        icpDefinition: Record<string, unknown> | null
    ): number {
        const icp = icpDefinition ?? {};

        const industryTargets = uniqueNormalized([
            ...extractStringList(getStringByPath(icp, 'industry')),
            ...extractStringList(getStringByPath(icp, 'industries')),
            ...extractStringList(getStringByPath(icp, 'targetIndustries')),
            ...extractStringList(getStringByPath(icp, 'firmographics.industry')),
            ...extractStringList(getStringByPath(icp, 'firmographics.industries')),
        ]);

        const roleTargets = uniqueNormalized([
            ...extractStringList(getStringByPath(icp, 'jobTitle')),
            ...extractStringList(getStringByPath(icp, 'jobTitles')),
            ...extractStringList(getStringByPath(icp, 'roles')),
            ...extractStringList(getStringByPath(icp, 'titles')),
            ...extractStringList(getStringByPath(icp, 'personas.titles')),
        ]);

        const companySizeTargets = uniqueNormalized([
            ...extractStringList(getStringByPath(icp, 'companySize')),
            ...extractStringList(getStringByPath(icp, 'companySizes')),
            ...extractStringList(getStringByPath(icp, 'sizes')),
            ...extractStringList(getStringByPath(icp, 'employeeRange')),
            ...extractStringList(getStringByPath(icp, 'firmographics.companySize')),
            ...extractStringList(getStringByPath(icp, 'firmographics.companySizes')),
        ]);

        const locationTargets = uniqueNormalized([
            ...extractStringList(getStringByPath(icp, 'location')),
            ...extractStringList(getStringByPath(icp, 'locations')),
            ...extractStringList(getStringByPath(icp, 'country')),
            ...extractStringList(getStringByPath(icp, 'countries')),
            ...extractStringList(getStringByPath(icp, 'regions')),
            ...extractStringList(getStringByPath(icp, 'firmographics.location')),
            ...extractStringList(getStringByPath(icp, 'firmographics.locations')),
        ]);

        const scoredFromDefinition =
            scoreIcpDimension([lead.industry], industryTargets, 8) +
            scoreIcpDimension(
                [lead.jobTitle, lead.seniority, lead.department],
                roleTargets,
                7
            ) +
            scoreIcpDimension([lead.companySize], companySizeTargets, 5) +
            scoreIcpDimension(
                [lead.city, lead.state, lead.country],
                locationTargets,
                5
            );

        if (typeof lead.icpMatch === 'number') {
            const historicalScore = clampInt(lead.icpMatch * 25, 0, 25);
            return clampInt((scoredFromDefinition + historicalScore) / 2, 0, 25);
        }

        return clampInt(scoredFromDefinition, 0, 25);
    }

    private determineTemperature(
        totalScore: number,
        signals: InteractionSignals,
        now: Date
    ): LeadTemperatureValue {
        const repliedRecently = dateWithinDays(signals.lastReplyAt, 3, now);
        const openedRecently = dateWithinDays(signals.lastOpenAt, 7, now);
        const inactiveMoreThan14Days = getDaysSince(signals.lastInteraction, now) > 14;

        if (repliedRecently || totalScore >= 70) {
            return 'HOT';
        }
        if (inactiveMoreThan14Days || totalScore < 40) {
            return 'COLD';
        }
        if (openedRecently || (totalScore >= 40 && totalScore <= 69)) {
            return 'WARM';
        }
        return 'COLD';
    }

    private getRecommendedAction(lead: LeaderboardLead): 'EMAIL' | 'WHATSAPP' | 'CALL' | 'REVIEW' {
        if (lead.temperature === 'HOT' && lead.phone) {
            return 'CALL';
        }
        if (lead.whatsapp) {
            return 'WHATSAPP';
        }
        if (lead.email) {
            return 'EMAIL';
        }
        if (lead.phone) {
            return 'CALL';
        }
        return 'REVIEW';
    }

    private computeLeadScore(
        lead: LeadForScoring,
        icpDefinition: Record<string, unknown> | null,
        now: Date
    ) {
        const enrichment = this.calculateEnrichmentScore(lead);
        const interactionSignals = this.calculateInteractionSignals(lead.messages, now);
        const interaction = interactionSignals.score;
        const timing = this.calculateTimingScore(interactionSignals, now);
        const icp = this.calculateIcpScore(lead, icpDefinition);

        const breakdown: ScoreBreakdown = {
            enrichment,
            interaction,
            timing,
            icp,
        };

        const score = clampInt(
            breakdown.enrichment +
                breakdown.interaction +
                breakdown.timing +
                breakdown.icp,
            0,
            100
        );

        const temperature = this.determineTemperature(score, interactionSignals, now);

        return {
            score,
            temperature,
            lastInteraction: interactionSignals.lastInteraction,
            scoreBreakdown: breakdown,
        };
    }

    async enqueueRecalculation(organizationId: string, input: RecalculateInput) {
        let leadIds: string[] | undefined;

        if (input.leadIds && input.leadIds.length > 0) {
            const uniqueIds = Array.from(new Set(input.leadIds));
            const leads = await prisma.lead.findMany({
                where: { id: { in: uniqueIds }, organizationId },
                select: { id: true },
            });
            if (leads.length === 0) {
                throw new Error('No leads found for recalculation');
            }
            leadIds = leads.map((lead) => lead.id);
        }

        const job = await scoringQueue.add('recalculate', {
            organizationId,
            leadIds,
            limit: input.limit,
        } satisfies ScoringRecalculateJobData);

        return {
            jobId: String(job.id),
            queued: true,
            leadCount: leadIds?.length ?? input.limit,
        };
    }

    async processRecalculateJob(data: ScoringRecalculateJobData) {
        const now = new Date();
        const organization = await prisma.organization.findUnique({
            where: { id: data.organizationId },
            select: { icpDefinition: true },
        });

        const where: Prisma.LeadWhereInput = {
            organizationId: data.organizationId,
        };
        if (data.leadIds && data.leadIds.length > 0) {
            where.id = { in: data.leadIds };
        }

        const leads = await prisma.lead.findMany({
            where,
            orderBy: data.leadIds && data.leadIds.length > 0
                ? { updatedAt: 'desc' }
                : [{ lastScoreUpdate: 'asc' }, { updatedAt: 'desc' }],
            take: data.leadIds && data.leadIds.length > 0 ? undefined : data.limit,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                fullName: true,
                email: true,
                emailVerified: true,
                phone: true,
                whatsapp: true,
                linkedinUrl: true,
                companyName: true,
                companyDomain: true,
                companyCnpj: true,
                companySize: true,
                industry: true,
                jobTitle: true,
                seniority: true,
                department: true,
                city: true,
                state: true,
                country: true,
                icpMatch: true,
                messages: {
                    select: {
                        type: true,
                        direction: true,
                        status: true,
                        createdAt: true,
                        openedAt: true,
                        clickedAt: true,
                        repliedAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                },
            },
        });

        if (leads.length === 0) {
            return {
                processed: 0,
                temperatures: { HOT: 0, WARM: 0, COLD: 0 },
            };
        }

        const temperatures = { HOT: 0, WARM: 0, COLD: 0 };

        for (const lead of leads) {
            const result = this.computeLeadScore(
                lead,
                (organization?.icpDefinition as Record<string, unknown> | null) ?? null,
                now
            );

            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    score: result.score,
                    temperature: result.temperature,
                    lastInteraction: result.lastInteraction,
                    lastScoreUpdate: now,
                    scoreBreakdown: result.scoreBreakdown as unknown as Prisma.InputJsonValue,
                },
            });

            temperatures[result.temperature] += 1;
        }

        return {
            processed: leads.length,
            temperatures,
        };
    }

    async getLeaderboard(organizationId: string, query: LeaderboardQuery) {
        const select = {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            email: true,
            phone: true,
            whatsapp: true,
            companyName: true,
            jobTitle: true,
            score: true,
            temperature: true,
            lastInteraction: true,
            scoreBreakdown: true,
            status: true,
        } satisfies Prisma.LeadSelect;

        const fetchBucket = async (temperature: LeadTemperatureValue, limit: number) => {
            if (limit <= 0) {
                return [] as LeaderboardLead[];
            }

            const rows = await prisma.lead.findMany({
                where: {
                    organizationId,
                    temperature,
                },
                select,
                orderBy: [{ score: 'desc' }, { lastInteraction: 'desc' }, { updatedAt: 'desc' }],
                take: limit,
            });

            return sortLeaderboardLeads(rows as LeaderboardLead[]);
        };

        let leads: LeaderboardLead[] = [];

        if (query.temperature) {
            leads = await fetchBucket(query.temperature, query.limit);
        } else {
            for (const temperature of TEMPERATURE_ORDER) {
                const remaining = query.limit - leads.length;
                if (remaining <= 0) {
                    break;
                }
                const bucket = await fetchBucket(temperature, remaining);
                leads.push(...bucket.slice(0, remaining));
            }
        }

        return leads.map((lead) => {
            const fallbackName =
                [lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
                lead.email ||
                lead.phone ||
                'Lead sem nome';

            return {
                id: lead.id,
                name: lead.fullName || fallbackName,
                email: lead.email,
                phone: lead.phone,
                whatsapp: lead.whatsapp,
                companyName: lead.companyName,
                jobTitle: lead.jobTitle,
                score: lead.score ?? 0,
                temperature: lead.temperature,
                status: lead.status,
                lastInteraction: lead.lastInteraction,
                scoreBreakdown: lead.scoreBreakdown,
                recommendedAction: this.getRecommendedAction(lead),
            };
        });
    }
}

export const scoringService = new ScoringService();

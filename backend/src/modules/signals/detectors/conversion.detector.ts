import { LeadStatus, SignalType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import {
    DetectorContext,
    DetectedSignal,
    clampInt,
    makeSignalSignature,
    percent,
    safeRate,
} from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const CONTACTED_STATUSES: LeadStatus[] = [
    LeadStatus.CONTACTED,
    LeadStatus.REPLIED,
    LeadStatus.INTERESTED,
    LeadStatus.MEETING_SCHEDULED,
    LeadStatus.CONVERTED,
    LeadStatus.NOT_INTERESTED,
    LeadStatus.BOUNCED,
    LeadStatus.UNSUBSCRIBED,
];

export async function detectConversionSignals(
    context: DetectorContext
): Promise<DetectedSignal[]> {
    const [convertedLeads, contactedLeads] = await Promise.all([
        prisma.lead.findMany({
            where: {
                organizationId: context.organizationId,
                status: LeadStatus.CONVERTED,
            },
            select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                messages: {
                    select: {
                        direction: true,
                        createdAt: true,
                        repliedAt: true,
                    },
                },
            },
            take: 3000,
            orderBy: {
                updatedAt: 'desc',
            },
        }),
        prisma.lead.count({
            where: {
                organizationId: context.organizationId,
                status: {
                    in: CONTACTED_STATUSES,
                },
            },
        }),
    ]);

    if (convertedLeads.length < 3) {
        return [];
    }

    const touchpoints: number[] = [];
    const conversionDays: number[] = [];

    for (const lead of convertedLeads) {
        const outboundTouches = lead.messages.filter(
            (message) => message.direction === 'OUTBOUND'
        ).length;
        touchpoints.push(outboundTouches);

        const elapsedDays = Math.max(0, (lead.updatedAt.getTime() - lead.createdAt.getTime()) / DAY_MS);
        conversionDays.push(elapsedDays);
    }

    const avgTouchpoints =
        touchpoints.reduce((sum, value) => sum + value, 0) / Math.max(touchpoints.length, 1);
    const avgDays =
        conversionDays.reduce((sum, value) => sum + value, 0) / Math.max(conversionDays.length, 1);

    const sortedTouchpoints = [...touchpoints].sort((a, b) => a - b);
    const p75Touchpoints =
        sortedTouchpoints[Math.floor(sortedTouchpoints.length * 0.75)] || sortedTouchpoints[0] || 0;

    const conversionRate = safeRate(convertedLeads.length, contactedLeads);

    const volumeConfidence =
        convertedLeads.length > 10
            ? 82
            : convertedLeads.length >= 7
                ? 74
                : convertedLeads.length >= 5
                    ? 66
                    : 58;
    const stabilityConfidence = clampInt(Math.min(p75Touchpoints, 8), 0, 10);
    const confidence = clampInt(volumeConfidence + stabilityConfidence, 45, 95);

    const insight = `Conversoes pedem em media ${avgTouchpoints.toFixed(1)} touchpoints e ${avgDays.toFixed(1)} dias ate fechar.`;

    return [
        {
            type: SignalType.CONVERSION,
            signature: makeSignalSignature(
                SignalType.CONVERSION,
                `${convertedLeads.length}:${avgTouchpoints.toFixed(2)}:${avgDays.toFixed(2)}`
            ),
            confidence,
            insight,
            dataPoints: convertedLeads.length,
            suggestedFormats: ['chart', 'thread', 'insight'],
            rawData: {
                convertedLeads: convertedLeads.length,
                contactedLeads,
                conversionRate: Number(conversionRate.toFixed(4)),
                avgTouchpoints: Number(avgTouchpoints.toFixed(3)),
                p75Touchpoints,
                avgDaysToConvert: Number(avgDays.toFixed(3)),
                touchpointDistribution: sortedTouchpoints,
                conversionRatePct: percent(conversionRate, 2),
            },
        },
    ];
}

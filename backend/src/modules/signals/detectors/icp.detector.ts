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

type SegmentStats = {
    industry: string;
    companySize: string;
    total: number;
    converted: number;
};

const POSITIVE_STATUSES = new Set<LeadStatus>([
    LeadStatus.REPLIED,
    LeadStatus.INTERESTED,
    LeadStatus.MEETING_SCHEDULED,
    LeadStatus.CONVERTED,
]);

function buildSegmentKey(industry: string, companySize: string): string {
    return `${industry}|${companySize}`;
}

function parseSegmentKey(key: string): { industry: string; companySize: string } {
    const [industry, companySize] = key.split('|');
    return {
        industry: industry || 'unknown',
        companySize: companySize || 'unknown',
    };
}

export async function detectIcpSignals(context: DetectorContext): Promise<DetectedSignal[]> {
    const leads = await prisma.lead.findMany({
        where: {
            organizationId: context.organizationId,
        },
        select: {
            industry: true,
            companySize: true,
            status: true,
        },
        take: 15000,
        orderBy: {
            createdAt: 'desc',
        },
    });

    if (leads.length < 30) {
        return [];
    }

    const segments = new Map<string, SegmentStats>();
    let totalLeads = 0;
    let totalConverted = 0;

    for (const lead of leads) {
        totalLeads += 1;
        if (POSITIVE_STATUSES.has(lead.status)) {
            totalConverted += 1;
        }

        const industry = (lead.industry || 'unknown').trim().toLowerCase();
        const companySize = (lead.companySize || 'unknown').trim().toLowerCase();
        const key = buildSegmentKey(industry, companySize);
        const current =
            segments.get(key) ||
            ({
                industry,
                companySize,
                total: 0,
                converted: 0,
            } satisfies SegmentStats);

        current.total += 1;
        if (POSITIVE_STATUSES.has(lead.status)) {
            current.converted += 1;
        }

        segments.set(key, current);
    }

    if (totalLeads < 30 || totalConverted < 6) {
        return [];
    }

    const baselineRate = safeRate(totalConverted, totalLeads);

    const ranked = Array.from(segments.values())
        .filter((segment) => segment.total >= 8 && segment.industry !== 'unknown')
        .sort((a, b) => {
            const rateDiff = safeRate(b.converted, b.total) - safeRate(a.converted, a.total);
            if (Math.abs(rateDiff) > 0.0001) {
                return rateDiff;
            }
            return b.total - a.total;
        });

    const best = ranked[0];
    if (!best || best.converted < 3) {
        return [];
    }

    const bestRate = safeRate(best.converted, best.total);
    const lift = bestRate - baselineRate;

    if (lift < 0.04) {
        return [];
    }

    const volumeConfidence =
        best.converted > 20
            ? 82
            : best.converted >= 12
                ? 74
                : best.converted >= 7
                    ? 66
                    : 58;
    const liftConfidence = clampInt(lift * 240, 0, 14);
    const confidence = clampInt(volumeConfidence + liftConfidence, 45, 95);

    const segmentLabel = `${best.industry}/${best.companySize}`;
    const insight = `Segmento ${segmentLabel} converte em ${percent(bestRate)}% (${best.converted}/${best.total}), acima da media ${percent(baselineRate)}%.`;

    const topSegments = ranked.slice(0, 6).map((segment) => ({
        ...parseSegmentKey(buildSegmentKey(segment.industry, segment.companySize)),
        total: segment.total,
        converted: segment.converted,
        conversionRate: Number(safeRate(segment.converted, segment.total).toFixed(4)),
    }));

    return [
        {
            type: SignalType.ICP,
            signature: makeSignalSignature(
                SignalType.ICP,
                `${segmentLabel}:${percent(bestRate, 2)}:${best.total}:${best.converted}`
            ),
            confidence,
            insight,
            dataPoints: best.total,
            suggestedFormats: ['thread', 'chart', 'insight'],
            rawData: {
                bestSegment: {
                    industry: best.industry,
                    companySize: best.companySize,
                    total: best.total,
                    converted: best.converted,
                    conversionRate: Number(bestRate.toFixed(4)),
                },
                baseline: {
                    total: totalLeads,
                    converted: totalConverted,
                    conversionRate: Number(baselineRate.toFixed(4)),
                },
                topSegments,
            },
        },
    ];
}

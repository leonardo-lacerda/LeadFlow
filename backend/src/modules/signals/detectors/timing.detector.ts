import { MessageStatus, SignalType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import {
    DetectorContext,
    DetectedSignal,
    clampInt,
    makeSignalSignature,
    percent,
    safeRate,
} from './types.js';

type BucketStats = {
    day: number;
    hour: number;
    sent: number;
    replied: number;
};

const WEEKDAY_LABELS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

const REPLIED_STATUSES: MessageStatus[] = [MessageStatus.REPLIED];

export async function detectTimingSignals(context: DetectorContext): Promise<DetectedSignal[]> {
    const rows = await prisma.message.findMany({
        where: {
            lead: {
                organizationId: context.organizationId,
            },
            direction: 'OUTBOUND',
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 12000,
        select: {
            createdAt: true,
            sentAt: true,
            repliedAt: true,
            status: true,
        },
    });

    if (rows.length < 25) {
        return [];
    }

    const buckets = new Map<string, BucketStats>();
    let totalSent = 0;
    let totalReplied = 0;

    for (const row of rows) {
        const sentAt = row.sentAt || row.createdAt;
        const day = sentAt.getUTCDay();
        const hour = sentAt.getUTCHours();
        const key = `${day}:${hour}`;
        const bucket = buckets.get(key) || {
            day,
            hour,
            sent: 0,
            replied: 0,
        };

        bucket.sent += 1;
        totalSent += 1;

        const replied = Boolean(row.repliedAt) || REPLIED_STATUSES.includes(row.status);
        if (replied) {
            bucket.replied += 1;
            totalReplied += 1;
        }

        buckets.set(key, bucket);
    }

    if (totalSent < 25) {
        return [];
    }

    const overallRate = safeRate(totalReplied, totalSent);
    const ranked = Array.from(buckets.values())
        .filter((item) => item.sent >= 5)
        .sort((a, b) => {
            const rateDiff = safeRate(b.replied, b.sent) - safeRate(a.replied, a.sent);
            if (Math.abs(rateDiff) > 0.0001) {
                return rateDiff;
            }
            return b.sent - a.sent;
        });

    const best = ranked[0];
    if (!best) {
        return [];
    }

    const bestRate = safeRate(best.replied, best.sent);
    const lift = bestRate - overallRate;

    if (best.sent < 8 && lift < 0.05) {
        return [];
    }

    const volumeConfidence =
        best.sent >= 50 ? 82 : best.sent >= 30 ? 74 : best.sent >= 15 ? 64 : 54;
    const liftConfidence = clampInt(lift * 220, 0, 14);
    const confidence = clampInt(volumeConfidence + liftConfidence, 45, 96);

    const topBuckets = ranked.slice(0, 6).map((item) => ({
        day: item.day,
        dayLabel: WEEKDAY_LABELS[item.day],
        hour: item.hour,
        sent: item.sent,
        replied: item.replied,
        replyRate: Number(safeRate(item.replied, item.sent).toFixed(4)),
    }));

    const dayLabel = WEEKDAY_LABELS[best.day] || 'dia';
    const bestPct = percent(bestRate);
    const baselinePct = percent(overallRate);
    const insight = `${dayLabel} ${String(best.hour).padStart(2, '0')}h UTC gera ${bestPct}% de replies (${best.replied}/${best.sent}), acima da media ${baselinePct}%.`;

    return [
        {
            type: SignalType.TIMING,
            signature: makeSignalSignature(
                SignalType.TIMING,
                `${best.day}:${best.hour}:${bestPct}:${totalSent}`
            ),
            confidence,
            insight,
            dataPoints: totalSent,
            suggestedFormats: ['tweet', 'chart', 'insight'],
            rawData: {
                bestWindow: {
                    dayOfWeek: dayLabel,
                    dayIndex: best.day,
                    hourUtc: best.hour,
                    sent: best.sent,
                    replied: best.replied,
                    replyRate: Number(bestRate.toFixed(4)),
                },
                baseline: {
                    sent: totalSent,
                    replied: totalReplied,
                    replyRate: Number(overallRate.toFixed(4)),
                },
                topBuckets,
            },
        },
    ];
}

import { MessageStatus, MessageType, SignalType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import {
    DetectorContext,
    DetectedSignal,
    clampInt,
    makeSignalSignature,
    percent,
    safeRate,
} from './types.js';

type ChannelStats = {
    sent: number;
    replied: number;
    bounced: number;
};

type ChannelType = 'EMAIL' | 'WHATSAPP';

const BOUNCE_STATUSES: MessageStatus[] = [MessageStatus.BOUNCED, MessageStatus.FAILED];

function channelLabel(type: MessageType): string {
    return type === MessageType.WHATSAPP ? 'WhatsApp' : 'Email';
}

export async function detectChannelSignals(context: DetectorContext): Promise<DetectedSignal[]> {
    const rows = await prisma.message.findMany({
        where: {
            lead: {
                organizationId: context.organizationId,
            },
            direction: 'OUTBOUND',
            type: {
                in: [MessageType.EMAIL, MessageType.WHATSAPP],
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 15000,
        select: {
            type: true,
            status: true,
            repliedAt: true,
        },
    });

    if (rows.length < 20) {
        return [];
    }

    const stats: Record<ChannelType, ChannelStats> = {
        EMAIL: { sent: 0, replied: 0, bounced: 0 },
        WHATSAPP: { sent: 0, replied: 0, bounced: 0 },
    };

    for (const row of rows) {
        const current = stats[row.type as ChannelType];
        if (!current) {
            continue;
        }

        current.sent += 1;

        if (row.repliedAt || row.status === MessageStatus.REPLIED) {
            current.replied += 1;
        }

        if (BOUNCE_STATUSES.includes(row.status)) {
            current.bounced += 1;
        }
    }

    const emailRate = safeRate(stats.EMAIL.replied, stats.EMAIL.sent);
    const whatsappRate = safeRate(stats.WHATSAPP.replied, stats.WHATSAPP.sent);

    const winnerType = whatsappRate >= emailRate ? MessageType.WHATSAPP : MessageType.EMAIL;
    const loserType = winnerType === MessageType.WHATSAPP ? MessageType.EMAIL : MessageType.WHATSAPP;

    const winner = stats[winnerType];
    const loser = stats[loserType];

    if (winner.sent < 12) {
        return [];
    }

    const winnerRate = safeRate(winner.replied, winner.sent);
    const loserRate = safeRate(loser.replied, loser.sent);
    const rateGap = winnerRate - loserRate;

    if (loser.sent >= 8 && rateGap < 0.03) {
        return [];
    }

    const rateRatio = loserRate > 0 ? winnerRate / loserRate : winnerRate > 0 ? 2 : 1;
    const volumeConfidence =
        winner.sent >= 30 ? 80 : winner.sent >= 20 ? 70 : winner.sent >= 12 ? 60 : 50;
    const gapConfidence = clampInt(rateGap * 280, 0, 15);
    const confidence = clampInt(volumeConfidence + gapConfidence, 45, 95);

    const insight = `${channelLabel(winnerType)} performa ${rateRatio.toFixed(1)}x melhor em replies (${percent(winnerRate)}% vs ${percent(loserRate)}%).`;

    return [
        {
            type: SignalType.CHANNEL,
            signature: makeSignalSignature(
                SignalType.CHANNEL,
                `${winnerType}:${percent(winnerRate, 2)}:${percent(loserRate, 2)}:${winner.sent}:${loser.sent}`
            ),
            confidence,
            insight,
            dataPoints: winner.sent + loser.sent,
            suggestedFormats: ['tweet', 'chart', 'insight'],
            rawData: {
                winner: {
                    channel: winnerType,
                    sent: winner.sent,
                    replied: winner.replied,
                    bounced: winner.bounced,
                    replyRate: Number(winnerRate.toFixed(4)),
                },
                loser: {
                    channel: loserType,
                    sent: loser.sent,
                    replied: loser.replied,
                    bounced: loser.bounced,
                    replyRate: Number(loserRate.toFixed(4)),
                },
                rateGap: Number(rateGap.toFixed(4)),
                rateRatio: Number(rateRatio.toFixed(3)),
            },
        },
    ];
}

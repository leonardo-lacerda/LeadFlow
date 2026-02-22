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

type StepStats = {
    stepId: string;
    campaignId: string | null;
    campaignName: string;
    stepType: string;
    contentPreview: string;
    sent: number;
    replied: number;
};

function compactPreview(content: string): string {
    return content.replace(/\s+/g, ' ').trim().slice(0, 90);
}

export async function detectMessageSignals(context: DetectorContext): Promise<DetectedSignal[]> {
    const rows = await prisma.message.findMany({
        where: {
            lead: {
                organizationId: context.organizationId,
            },
            direction: 'OUTBOUND',
            campaignStepId: {
                not: null,
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 12000,
        select: {
            status: true,
            repliedAt: true,
            campaignStep: {
                select: {
                    id: true,
                    type: true,
                    content: true,
                    campaign: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (rows.length < 20) {
        return [];
    }

    const steps = new Map<string, StepStats>();
    let totalSent = 0;
    let totalReplied = 0;

    for (const row of rows) {
        const step = row.campaignStep;
        if (!step) {
            continue;
        }

        const current =
            steps.get(step.id) ||
            ({
                stepId: step.id,
                campaignId: step.campaign?.id || null,
                campaignName: step.campaign?.name || 'Campanha',
                stepType: step.type,
                contentPreview: compactPreview(step.content),
                sent: 0,
                replied: 0,
            } satisfies StepStats);

        current.sent += 1;
        totalSent += 1;

        if (row.repliedAt || row.status === MessageStatus.REPLIED) {
            current.replied += 1;
            totalReplied += 1;
        }

        steps.set(step.id, current);
    }

    if (totalSent < 20) {
        return [];
    }

    const baselineRate = safeRate(totalReplied, totalSent);
    const ranked = Array.from(steps.values())
        .filter((step) => step.sent >= 6)
        .sort((a, b) => {
            const rateDiff = safeRate(b.replied, b.sent) - safeRate(a.replied, a.sent);
            if (Math.abs(rateDiff) > 0.0001) {
                return rateDiff;
            }
            return b.sent - a.sent;
        });

    const best = ranked[0];
    if (!best || best.replied < 2) {
        return [];
    }

    const bestRate = safeRate(best.replied, best.sent);
    const lift = bestRate - baselineRate;

    if (lift < 0.05) {
        return [];
    }

    const volumeConfidence =
        best.sent > 25 ? 82 : best.sent > 15 ? 74 : best.sent > 10 ? 66 : 58;
    const liftConfidence = clampInt(lift * 220, 0, 14);
    const confidence = clampInt(volumeConfidence + liftConfidence, 45, 96);

    const insight = `Step de mensagem "${best.contentPreview}" gera ${percent(bestRate)}% de replies (${best.replied}/${best.sent}), media geral ${percent(baselineRate)}%.`;

    const topSteps = ranked.slice(0, 5).map((step) => ({
        stepId: step.stepId,
        campaignId: step.campaignId,
        campaignName: step.campaignName,
        stepType: step.stepType,
        contentPreview: step.contentPreview,
        sent: step.sent,
        replied: step.replied,
        replyRate: Number(safeRate(step.replied, step.sent).toFixed(4)),
    }));

    return [
        {
            type: SignalType.MESSAGE,
            signature: makeSignalSignature(
                SignalType.MESSAGE,
                `${best.stepId}:${percent(bestRate, 2)}:${best.sent}:${best.replied}`
            ),
            confidence,
            insight,
            dataPoints: best.sent,
            suggestedFormats: ['thread', 'micro-case', 'insight'],
            rawData: {
                bestStep: {
                    stepId: best.stepId,
                    campaignId: best.campaignId,
                    campaignName: best.campaignName,
                    stepType: best.stepType,
                    contentPreview: best.contentPreview,
                    sent: best.sent,
                    replied: best.replied,
                    replyRate: Number(bestRate.toFixed(4)),
                },
                baseline: {
                    sent: totalSent,
                    replied: totalReplied,
                    replyRate: Number(baselineRate.toFixed(4)),
                },
                topSteps,
            },
        },
    ];
}

import { SignalType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import {
    DetectorContext,
    DetectedSignal,
    clampInt,
    makeSignalSignature,
    normalizeText,
    percent,
    safeRate,
} from './types.js';

type ObjectionCategory = 'preco' | 'timing' | 'autoridade' | 'concorrencia' | 'desinteresse';

const KEYWORDS: Record<ObjectionCategory, string[]> = {
    preco: ['caro', 'preco', 'orcamento', 'budget', 'valor', 'custo'],
    timing: ['agora nao', 'sem prioridade', 'depois', 'proximo trimestre', 'momento'],
    autoridade: ['nao sou', 'decisor', 'aprovacao', 'diretor', 'comercial cuida'],
    concorrencia: ['ja usamos', 'concorrente', 'fornecedor atual', 'parceiro atual'],
    desinteresse: ['sem interesse', 'nao tenho interesse', 'remover', 'pare de enviar'],
};

function findCategories(message: string): ObjectionCategory[] {
    const text = normalizeText(message);
    const matches: ObjectionCategory[] = [];

    for (const [category, terms] of Object.entries(KEYWORDS) as Array<[
        ObjectionCategory,
        string[],
    ]>) {
        if (terms.some((term) => text.includes(term))) {
            matches.push(category);
        }
    }

    return matches;
}

export async function detectObjectionSignals(context: DetectorContext): Promise<DetectedSignal[]> {
    const rows = await prisma.message.findMany({
        where: {
            lead: {
                organizationId: context.organizationId,
            },
            direction: 'INBOUND',
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 8000,
        select: {
            content: true,
        },
    });

    if (rows.length < 15) {
        return [];
    }

    const counts: Record<ObjectionCategory, number> = {
        preco: 0,
        timing: 0,
        autoridade: 0,
        concorrencia: 0,
        desinteresse: 0,
    };

    const samples: Record<ObjectionCategory, string[]> = {
        preco: [],
        timing: [],
        autoridade: [],
        concorrencia: [],
        desinteresse: [],
    };

    let matchedMessages = 0;

    for (const row of rows) {
        const categories = findCategories(row.content || '');
        if (categories.length === 0) {
            continue;
        }

        matchedMessages += 1;
        for (const category of categories) {
            counts[category] += 1;
            if (samples[category].length < 4) {
                samples[category].push(row.content.replace(/\s+/g, ' ').trim().slice(0, 110));
            }
        }
    }

    if (matchedMessages < 5) {
        return [];
    }

    const ranked = (Object.keys(counts) as ObjectionCategory[])
        .map((category) => ({
            category,
            count: counts[category],
            share: safeRate(counts[category], matchedMessages),
        }))
        .sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return b.share - a.share;
        });

    const top = ranked[0];
    if (!top || top.count < 3) {
        return [];
    }

    const volumeConfidence =
        matchedMessages > 35
            ? 80
            : matchedMessages > 25
                ? 72
                : matchedMessages > 15
                    ? 64
                    : 56;
    const shareConfidence = clampInt(top.share * 28, 0, 14);
    const confidence = clampInt(volumeConfidence + shareConfidence, 45, 94);

    const insight = `Objecao dominante nas replies: ${top.category} (${percent(top.share)}% das respostas analisadas).`;

    return [
        {
            type: SignalType.OBJECTION,
            signature: makeSignalSignature(
                SignalType.OBJECTION,
                `${top.category}:${top.count}:${matchedMessages}`
            ),
            confidence,
            insight,
            dataPoints: matchedMessages,
            suggestedFormats: ['tweet', 'micro-case', 'insight'],
            rawData: {
                topCategory: {
                    category: top.category,
                    count: top.count,
                    share: Number(top.share.toFixed(4)),
                    samples: samples[top.category],
                },
                categories: ranked.map((entry) => ({
                    category: entry.category,
                    count: entry.count,
                    share: Number(entry.share.toFixed(4)),
                })),
                repliesAnalyzed: rows.length,
                repliesMatched: matchedMessages,
            },
        },
    ];
}

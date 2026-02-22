import { DraftFormat, DraftStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateCase } from './generators/case.generator.js';
import { extractChartImageUrl, generateChart } from './generators/chart.generator.js';
import { generateThread } from './generators/thread.generator.js';
import { generateTweet } from './generators/tweet.generator.js';
import { distributionTrackingService } from './tracking.service.js';

interface ListDraftsQuery {
    page: number;
    limit: number;
    status?: DraftStatus;
    format?: DraftFormat;
}

interface GenerateDraftsInput {
    signalId: string;
    formats?: DraftFormat[];
}

interface UpdateDraftInput {
    editedContent?: string;
    status?: DraftStatus;
    platform?: string;
}

interface PublishDraftInput {
    platform?: string;
}

interface TrackInput {
    impressions?: number;
    engagement?: number;
}

interface DraftExportAsset {
    format: 'png';
    filename: string;
    url: string;
}

function renderDraftContent(
    format: DraftFormat,
    signal: {
        insight: string;
        dataPoints: number;
        type: string;
        rawData: Prisma.JsonValue;
    }
): string {
    const baseSignal = {
        insight: signal.insight,
        dataPoints: signal.dataPoints,
        type: signal.type,
        rawData: signal.rawData,
    };

    switch (format) {
        case DraftFormat.TWEET:
            return generateTweet(baseSignal);
        case DraftFormat.THREAD:
            return generateThread(baseSignal);
        case DraftFormat.CHART:
            return generateChart(baseSignal);
        case DraftFormat.MICRO_CASE:
            return generateCase(baseSignal);
        case DraftFormat.INSIGHT:
        default:
            return signal.insight;
    }
}

export class DistributionService {
    async listDrafts(organizationId: string, query: ListDraftsQuery) {
        const page = Math.max(1, query.page);
        const limit = Math.max(1, Math.min(100, query.limit));
        const skip = (page - 1) * limit;

        const where: Prisma.DistributionDraftWhereInput = {
            organizationId,
        };

        if (query.status) {
            where.status = query.status;
        }

        if (query.format) {
            where.format = query.format;
        }

        const [items, total] = await Promise.all([
            prisma.distributionDraft.findMany({
                where,
                include: {
                    signal: {
                        select: {
                            id: true,
                            type: true,
                            confidence: true,
                            insight: true,
                        },
                    },
                },
                orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: limit,
            }),
            prisma.distributionDraft.count({ where }),
        ]);

        return {
            items,
            total,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async getDraftById(organizationId: string, draftId: string) {
        const draft = await prisma.distributionDraft.findFirst({
            where: {
                id: draftId,
                organizationId,
            },
            include: {
                signal: true,
            },
        });

        if (!draft) {
            throw new Error('Distribution draft not found');
        }

        return draft;
    }

    async getDraftExportAsset(
        organizationId: string,
        draftId: string
    ): Promise<DraftExportAsset> {
        const draft = await prisma.distributionDraft.findFirst({
            where: {
                id: draftId,
                organizationId,
            },
            include: {
                signal: {
                    select: {
                        id: true,
                        type: true,
                        insight: true,
                        dataPoints: true,
                        rawData: true,
                    },
                },
            },
        });

        if (!draft) {
            throw new Error('Distribution draft not found');
        }

        if (draft.format !== DraftFormat.CHART) {
            throw new Error('Export is available only for chart drafts');
        }

        const effectiveContent = draft.editedContent || draft.content;
        let imageUrl = extractChartImageUrl(effectiveContent);

        if (!imageUrl && draft.signal) {
            imageUrl = extractChartImageUrl(
                generateChart({
                    insight: draft.signal.insight,
                    dataPoints: draft.signal.dataPoints,
                    type: draft.signal.type,
                    rawData: draft.signal.rawData,
                })
            );
        }

        if (!imageUrl) {
            throw new Error('Unable to build chart image URL for this draft');
        }

        const safeType = (draft.signal?.type || 'chart').toLowerCase();
        const filename = `${safeType}-${draft.id}.png`;

        return {
            format: 'png',
            filename,
            url: imageUrl,
        };
    }

    async generateDrafts(organizationId: string, input: GenerateDraftsInput) {
        const signal = await prisma.signal.findFirst({
            where: {
                id: input.signalId,
                organizationId,
            },
            select: {
                id: true,
                insight: true,
                dataPoints: true,
                type: true,
                rawData: true,
                status: true,
            },
        });

        if (!signal) {
            throw new Error('Signal not found');
        }

        const formats = input.formats && input.formats.length > 0
            ? Array.from(new Set(input.formats))
            : [DraftFormat.TWEET, DraftFormat.THREAD, DraftFormat.INSIGHT];

        const created = [];

        for (const format of formats) {
            const content = renderDraftContent(format, {
                insight: signal.insight,
                dataPoints: signal.dataPoints,
                type: signal.type,
                rawData: signal.rawData,
            });

            const draft = await prisma.distributionDraft.create({
                data: {
                    organizationId,
                    signalId: signal.id,
                    format,
                    content,
                    status: DraftStatus.DRAFT,
                },
            });
            created.push(draft);
        }

        await prisma.signal.update({
            where: { id: signal.id },
            data: {
                status: 'USED',
            },
        });

        return {
            created,
        };
    }

    async updateDraft(organizationId: string, draftId: string, input: UpdateDraftInput) {
        const draft = await prisma.distributionDraft.findFirst({
            where: {
                id: draftId,
                organizationId,
            },
            select: {
                id: true,
            },
        });

        if (!draft) {
            throw new Error('Distribution draft not found');
        }

        return prisma.distributionDraft.update({
            where: {
                id: draft.id,
            },
            data: {
                editedContent: input.editedContent,
                status: input.status,
                platform: input.platform,
            },
        });
    }

    async publishDraft(organizationId: string, draftId: string, input: PublishDraftInput) {
        const draft = await prisma.distributionDraft.findFirst({
            where: {
                id: draftId,
                organizationId,
            },
            select: {
                id: true,
                status: true,
                platform: true,
            },
        });

        if (!draft) {
            throw new Error('Distribution draft not found');
        }

        return prisma.distributionDraft.update({
            where: {
                id: draft.id,
            },
            data: {
                status: DraftStatus.PUBLISHED,
                platform: input.platform || draft.platform || undefined,
                publishedAt: new Date(),
            },
        });
    }

    async trackDraft(organizationId: string, draftId: string, input: TrackInput) {
        return distributionTrackingService.recordEngagement(organizationId, draftId, input);
    }
}

export const distributionService = new DistributionService();

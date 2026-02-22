import { Prisma, SignalStatus, SignalType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { detectChannelSignals } from './detectors/channel.detector.js';
import { detectConversionSignals } from './detectors/conversion.detector.js';
import { detectIcpSignals } from './detectors/icp.detector.js';
import { detectMessageSignals } from './detectors/message.detector.js';
import { detectObjectionSignals } from './detectors/objection.detector.js';
import { detectTimingSignals } from './detectors/timing.detector.js';
import { DetectorContext, DetectedSignal } from './detectors/types.js';

interface ListSignalsQuery {
    page: number;
    limit: number;
    type?: SignalType;
    status?: SignalStatus;
    minConfidence?: number;
}

interface RunDetectionOptions {
    minConfidence?: number;
}

const DETECTORS: Array<{
    name: string;
    run: (context: DetectorContext) => Promise<DetectedSignal[]>;
}> = [
    { name: 'timing', run: detectTimingSignals },
    { name: 'channel', run: detectChannelSignals },
    { name: 'icp', run: detectIcpSignals },
    { name: 'message', run: detectMessageSignals },
    { name: 'objection', run: detectObjectionSignals },
    { name: 'conversion', run: detectConversionSignals },
];

export class SignalService {
    async runDetectionForOrganization(
        organizationId: string,
        options: RunDetectionOptions = {}
    ) {
        const now = new Date();
        const minConfidence = Math.max(0, Math.min(100, options.minConfidence ?? 55));

        const detectorRuns = await Promise.all(
            DETECTORS.map(async (detector) => {
                try {
                    const items = await detector.run({ organizationId, now });
                    return {
                        detector: detector.name,
                        items,
                        error: null as string | null,
                    };
                } catch (error) {
                    return {
                        detector: detector.name,
                        items: [] as DetectedSignal[],
                        error:
                            error instanceof Error
                                ? error.message
                                : `Detector ${detector.name} failed`,
                    };
                }
            })
        );

        const detectorErrors = detectorRuns
            .filter((run) => run.error)
            .map((run) => ({
                detector: run.detector,
                error: run.error as string,
            }));

        const deduped = new Map<string, DetectedSignal>();
        for (const candidate of detectorRuns.flatMap((run) => run.items)) {
            if (candidate.confidence < minConfidence) {
                continue;
            }

            const existing = deduped.get(candidate.signature);
            if (!existing || candidate.confidence > existing.confidence) {
                deduped.set(candidate.signature, candidate);
            }
        }

        const candidates = Array.from(deduped.values());

        if (candidates.length === 0) {
            return {
                generatedAt: now.toISOString(),
                organizationId,
                scannedDetectors: DETECTORS.length,
                created: 0,
                updated: 0,
                totalCandidates: 0,
                minConfidence,
                detectorErrors,
            };
        }

        const signatures = candidates.map((candidate) => candidate.signature);
        const existingSignals = await prisma.signal.findMany({
            where: {
                organizationId,
                signature: {
                    in: signatures,
                },
            },
            select: {
                id: true,
                signature: true,
            },
        });

        const existingSet = new Set(existingSignals.map((item) => item.signature));

        let created = 0;
        let updated = 0;

        for (const candidate of candidates) {
            if (existingSet.has(candidate.signature)) {
                await prisma.signal.update({
                    where: {
                        organizationId_signature: {
                            organizationId,
                            signature: candidate.signature,
                        },
                    },
                    data: {
                        type: candidate.type,
                        confidence: candidate.confidence,
                        insight: candidate.insight,
                        dataPoints: candidate.dataPoints,
                        suggestedFormats: candidate.suggestedFormats,
                        rawData: candidate.rawData,
                    },
                });
                updated += 1;
            } else {
                await prisma.signal.create({
                    data: {
                        organizationId,
                        signature: candidate.signature,
                        type: candidate.type,
                        confidence: candidate.confidence,
                        insight: candidate.insight,
                        dataPoints: candidate.dataPoints,
                        suggestedFormats: candidate.suggestedFormats,
                        rawData: candidate.rawData,
                        status: SignalStatus.NEW,
                    },
                });
                created += 1;
            }
        }

        return {
            generatedAt: now.toISOString(),
            organizationId,
            scannedDetectors: DETECTORS.length,
            created,
            updated,
            totalCandidates: candidates.length,
            minConfidence,
            detectorErrors,
        };
    }

    async runDetectionForAllOrganizations(options: RunDetectionOptions = {}) {
        const organizations = await prisma.organization.findMany({
            select: {
                id: true,
            },
        });

        const summaries: Array<{
            organizationId: string;
            created: number;
            updated: number;
            totalCandidates: number;
            detectorErrors: Array<{ detector: string; error: string }>;
        }> = [];

        for (const organization of organizations) {
            const result = await this.runDetectionForOrganization(organization.id, options);
            summaries.push({
                organizationId: organization.id,
                created: result.created,
                updated: result.updated,
                totalCandidates: result.totalCandidates,
                detectorErrors: result.detectorErrors,
            });
        }

        return {
            generatedAt: new Date().toISOString(),
            organizations: organizations.length,
            created: summaries.reduce((acc, item) => acc + item.created, 0),
            updated: summaries.reduce((acc, item) => acc + item.updated, 0),
            totalCandidates: summaries.reduce((acc, item) => acc + item.totalCandidates, 0),
            summaries,
        };
    }

    async listSignals(organizationId: string, query: ListSignalsQuery) {
        const where: Prisma.SignalWhereInput = {
            organizationId,
        };

        if (query.type) {
            where.type = query.type;
        }

        if (query.status) {
            where.status = query.status;
        }

        if (typeof query.minConfidence === 'number') {
            where.confidence = {
                gte: query.minConfidence,
            };
        }

        const skip = (query.page - 1) * query.limit;

        const [items, total] = await Promise.all([
            prisma.signal.findMany({
                where,
                orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
                skip,
                take: query.limit,
            }),
            prisma.signal.count({ where }),
        ]);

        return {
            items,
            total,
            meta: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / query.limit)),
            },
        };
    }

    async updateSignalStatus(organizationId: string, signalId: string, status: SignalStatus) {
        const result = await prisma.signal.updateMany({
            where: {
                id: signalId,
                organizationId,
            },
            data: {
                status,
            },
        });

        if (result.count === 0) {
            throw new Error('Signal not found');
        }

        return prisma.signal.findFirst({
            where: {
                id: signalId,
                organizationId,
            },
        });
    }

    async getSignalSummary(organizationId: string) {
        const [byType, byStatus, latest] = await Promise.all([
            prisma.signal.groupBy({
                by: ['type'],
                where: { organizationId },
                _count: { _all: true },
                _avg: { confidence: true },
            }),
            prisma.signal.groupBy({
                by: ['status'],
                where: { organizationId },
                _count: { _all: true },
            }),
            prisma.signal.findFirst({
                where: { organizationId },
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
            }),
        ]);

        return {
            byType: byType.map((item) => ({
                type: item.type,
                count: item._count._all,
                averageConfidence: Number((item._avg.confidence || 0).toFixed(2)),
            })),
            byStatus: byStatus.map((item) => ({
                status: item.status,
                count: item._count._all,
            })),
            lastGeneratedAt: latest?.updatedAt?.toISOString() || null,
        };
    }
}

export const signalService = new SignalService();

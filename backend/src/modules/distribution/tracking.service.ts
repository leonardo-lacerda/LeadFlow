import { prisma } from '../../lib/prisma.js';

export class DistributionTrackingService {
    async recordEngagement(
        organizationId: string,
        draftId: string,
        input: {
            impressions?: number;
            engagement?: number;
        }
    ) {
        const draft = await prisma.distributionDraft.findFirst({
            where: {
                id: draftId,
                organizationId,
            },
            select: {
                id: true,
                impressions: true,
                engagement: true,
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
                impressions:
                    typeof input.impressions === 'number'
                        ? input.impressions
                        : draft.impressions || undefined,
                engagement:
                    typeof input.engagement === 'number'
                        ? input.engagement
                        : draft.engagement || undefined,
            },
        });
    }
}

export const distributionTrackingService = new DistributionTrackingService();

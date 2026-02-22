import { SignalChannel, SignalEventType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { anonymizeSegment, shouldExposeBucket } from './anonymizer.js';

interface NetworkSignalsQuery {
    windowDays: number;
}

function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export class NetworkService {
    private async optedInOrganizationIds(excludeOrganizationId?: string) {
        const organizations = await prisma.organization.findMany({
            where: {
                networkOptIn: true,
                ...(excludeOrganizationId
                    ? {
                          id: {
                              not: excludeOrganizationId,
                          },
                      }
                    : {}),
            },
            select: {
                id: true,
            },
        });

        return organizations.map((org) => org.id);
    }

    async getSignals(organizationId: string, query: NetworkSignalsQuery) {
        const windowDays = Math.max(7, Math.min(180, query.windowDays));
        const orgIds = await this.optedInOrganizationIds(organizationId);

        if (orgIds.length === 0) {
            return {
                windowDays,
                activeOrganizations: 0,
                segments: [],
                channels: [],
            };
        }

        const since = daysAgo(windowDays);

        const [bySegment, byChannel] = await Promise.all([
            prisma.signalEvent.groupBy({
                by: ['leadSegment', 'eventType'],
                where: {
                    organizationId: {
                        in: orgIds,
                    },
                    eventAt: {
                        gte: since,
                    },
                    leadSegment: {
                        not: null,
                    },
                    eventType: {
                        in: [SignalEventType.MESSAGE_SENT, SignalEventType.MESSAGE_REPLY_RECEIVED],
                    },
                },
                _count: {
                    _all: true,
                },
            }),
            prisma.signalEvent.groupBy({
                by: ['channel', 'eventType'],
                where: {
                    organizationId: {
                        in: orgIds,
                    },
                    eventAt: {
                        gte: since,
                    },
                    channel: {
                        in: [SignalChannel.EMAIL, SignalChannel.WHATSAPP],
                    },
                    eventType: {
                        in: [SignalEventType.MESSAGE_SENT, SignalEventType.MESSAGE_REPLY_RECEIVED],
                    },
                },
                _count: {
                    _all: true,
                },
            }),
        ]);

        const segmentMap = new Map<string, { sent: number; replied: number }>();

        for (const row of bySegment) {
            const segment = anonymizeSegment(row.leadSegment);
            const current = segmentMap.get(segment) || { sent: 0, replied: 0 };
            if (row.eventType === SignalEventType.MESSAGE_SENT) {
                current.sent += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
                current.replied += row._count._all;
            }
            segmentMap.set(segment, current);
        }

        const segments = Array.from(segmentMap.entries())
            .map(([segment, values]) => ({
                segment,
                sent: values.sent,
                replied: values.replied,
                replyRate: values.sent > 0 ? Number((values.replied / values.sent).toFixed(4)) : 0,
            }))
            .filter((item) => shouldExposeBucket(item.sent, 5))
            .sort((a, b) => b.replyRate - a.replyRate)
            .slice(0, 20);

        const channelTotals = {
            email: { sent: 0, replied: 0 },
            whatsapp: { sent: 0, replied: 0 },
        };

        for (const row of byChannel) {
            const key = row.channel === SignalChannel.WHATSAPP ? 'whatsapp' : 'email';
            if (row.eventType === SignalEventType.MESSAGE_SENT) {
                channelTotals[key].sent += row._count._all;
            } else if (row.eventType === SignalEventType.MESSAGE_REPLY_RECEIVED) {
                channelTotals[key].replied += row._count._all;
            }
        }

        const channels = Object.entries(channelTotals).map(([channel, values]) => ({
            channel,
            sent: values.sent,
            replied: values.replied,
            replyRate: values.sent > 0 ? Number((values.replied / values.sent).toFixed(4)) : 0,
        }));

        return {
            windowDays,
            activeOrganizations: orgIds.length,
            segments,
            channels,
        };
    }

    async getStats(organizationId: string) {
        const [organization, optedInCount, claims, drafts] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: organizationId },
                select: {
                    networkOptIn: true,
                },
            }),
            prisma.organization.count({
                where: {
                    networkOptIn: true,
                },
            }),
            prisma.sharedLeadClaim.count({
                where: {
                    organizationId,
                },
            }),
            prisma.distributionDraft.count({
                where: {
                    organizationId,
                    status: 'PUBLISHED',
                },
            }),
        ]);

        return {
            networkOptIn: organization?.networkOptIn || false,
            optedInOrganizations: optedInCount,
            claimedSharedLeads: claims,
            publishedDrafts: drafts,
        };
    }
}

export const networkService = new NetworkService();

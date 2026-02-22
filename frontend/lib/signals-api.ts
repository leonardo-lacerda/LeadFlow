import { api } from '@/lib/api';

export type SignalRecommendationChannel = 'email' | 'whatsapp';
export type SignalRecordType =
    | 'TIMING'
    | 'CHANNEL'
    | 'ICP'
    | 'MESSAGE'
    | 'OBJECTION'
    | 'CONVERSION';
export type SignalRecordStatus = 'NEW' | 'SEEN' | 'USED' | 'DISMISSED';

export interface SignalLeadRecommendation {
    leadId: string;
    leadSegment: string;
    sharedScore: number;
    recommendedChannel: SignalRecommendationChannel;
    bestWindow: {
        dayOfWeek: string;
        hour: number;
        timezone: string;
    };
    confidence: number;
    reasons: string[];
    aggregateImpact: {
        segmentReplyRate: number;
        channelReplyRate: number;
        channelBounceRate: number;
    };
}

export interface SignalsOverview {
    windowDays: number;
    generatedAt: string;
    organization: {
        signals: number;
        topChannel: SignalRecommendationChannel;
        channelPerformance: {
            email: {
                sent: number;
                replied: number;
                bounced: number;
                failed: number;
                replyRate: number;
                bounceRate: number;
            };
            whatsapp: {
                sent: number;
                replied: number;
                bounced: number;
                failed: number;
                replyRate: number;
                bounceRate: number;
            };
        };
        segmentCoverage: number;
    };
    network: {
        signals: number;
        activeOrganizations: number;
        topChannel: SignalRecommendationChannel;
        bestWindow: {
            dayOfWeek: string;
            hour: number;
            timezone: string;
            confidence: number;
        };
    };
}

export interface SignalAlert {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    recommendedAction: string;
    leadId?: string;
    createdAt: string;
}

export interface SignalImpact {
    windowDays: number;
    generatedAt: string;
    summary: {
        overallLift: number;
        topOpportunityChannel: SignalRecommendationChannel;
    };
    byChannel: Array<{
        channel: SignalRecommendationChannel;
        organizationReplyRate: number;
        networkReplyRate: number;
        organizationBounceRate: number;
        lift: number;
    }>;
    bySegment: Array<{
        segment: string;
        sent: number;
        organizationReplyRate: number;
        networkReplyRate: number;
        organizationBounceRate: number;
        lift: number;
    }>;
}

export interface SignalCampaignRecommendation {
    campaignId: string;
    campaignName: string;
    analyzedLeads: number;
    averageSharedScore: number;
    recommendedChannelMix: {
        email: number;
        whatsapp: number;
    };
    bestWindow: {
        dayOfWeek: string;
        hour: number;
        timezone: string;
    };
    aggregateImpact?: {
        sent: number;
        replied: number;
        bounced: number;
        replyRate: number;
        bounceRate: number;
    };
}

export interface SignalCohortStatus {
    cohort: 'beta' | 'early' | 'scale';
    currentPlan: string;
    period: {
        startsAt: string;
        endsAt: string;
    };
    usage: {
        signalsUsed: number;
        signalsLimit: number;
        remaining: number;
        usagePercent: number;
    };
    byChannel: Array<{
        channel: SignalRecommendationChannel;
        signals: number;
    }>;
    tierRecommendation: {
        recommendedTier: 'Starter' | 'Growth' | 'Scale';
        reason: string;
    };
}

export interface SignalRecord {
    id: string;
    organizationId: string;
    signature: string;
    type: SignalRecordType;
    confidence: number;
    insight: string;
    dataPoints: number;
    suggestedFormats: string[];
    rawData: unknown;
    status: SignalRecordStatus;
    createdAt: string;
    updatedAt: string;
}

export interface SignalSummary {
    byType: Array<{
        type: SignalRecordType;
        count: number;
        averageConfidence: number;
    }>;
    byStatus: Array<{
        status: SignalRecordStatus;
        count: number;
    }>;
    lastGeneratedAt: string | null;
}

export const signalsApi = {
    async listSignals(params?: {
        page?: number;
        limit?: number;
        type?: SignalRecordType;
        status?: SignalRecordStatus;
        minConfidence?: number;
    }): Promise<{
        items: SignalRecord[];
        total: number;
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const response = await api.get('/signals', { params });
        return response.data.data;
    },

    async getSignalSummary(): Promise<SignalSummary> {
        const response = await api.get('/signals/summary');
        return response.data.data;
    },

    async runDetection(input?: {
        minConfidence?: number;
        async?: boolean;
    }): Promise<{
        queued?: boolean;
        jobId?: string;
        generatedAt?: string;
        created?: number;
        updated?: number;
        totalCandidates?: number;
    }> {
        const response = await api.post('/signals/detect', input || {});
        return response.data.data;
    },

    async updateSignalStatus(
        signalId: string,
        status: SignalRecordStatus
    ): Promise<SignalRecord> {
        const response = await api.patch(`/signals/${signalId}/status`, { status });
        return response.data.data;
    },

    async getOverview(): Promise<SignalsOverview> {
        const response = await api.get('/signals/overview');
        return response.data.data;
    },

    async getLeadRecommendation(leadId: string): Promise<SignalLeadRecommendation> {
        const response = await api.get(`/signals/leads/${leadId}/recommendation`);
        return response.data.data;
    },

    async getLeadRecommendations(leadIds: string[]): Promise<SignalLeadRecommendation[]> {
        const response = await api.post('/signals/leads/recommendations', { leadIds });
        return response.data.data;
    },

    async getCampaignRecommendation(campaignId: string): Promise<SignalCampaignRecommendation> {
        const response = await api.get(`/signals/campaigns/${campaignId}/recommendation`);
        return response.data.data;
    },

    async getActionableAlerts(limit = 12): Promise<SignalAlert[]> {
        const response = await api.get('/signals/actionable-alerts', {
            params: { limit },
        });
        return response.data.data;
    },

    async getImpact(): Promise<SignalImpact> {
        const response = await api.get('/signals/impact');
        return response.data.data;
    },

    async getCohortStatus(): Promise<SignalCohortStatus> {
        const response = await api.get('/signals/cohort-status');
        return response.data.data;
    },

    async backfill(limit = 1500): Promise<{ scanned: number; created: number }> {
        const response = await api.post('/signals/backfill', { limit });
        return response.data.data;
    },
};

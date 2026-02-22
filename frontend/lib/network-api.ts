import { api } from '@/lib/api';

export interface NetworkSignalSegment {
    segment: string;
    sent: number;
    replied: number;
    replyRate: number;
}

export interface NetworkChannelPerformance {
    channel: string;
    sent: number;
    replied: number;
    replyRate: number;
}

export const networkApi = {
    async getSignals(params?: { windowDays?: number }): Promise<{
        windowDays: number;
        activeOrganizations: number;
        segments: NetworkSignalSegment[];
        channels: NetworkChannelPerformance[];
    }> {
        const response = await api.get('/network/signals', { params });
        return response.data.data;
    },

    async getStats(): Promise<{
        networkOptIn: boolean;
        optedInOrganizations: number;
        claimedSharedLeads: number;
        publishedDrafts: number;
    }> {
        const response = await api.get('/network/stats');
        return response.data.data;
    },
};

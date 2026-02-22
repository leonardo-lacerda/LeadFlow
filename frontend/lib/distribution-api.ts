import { api } from '@/lib/api';

export type DraftFormat = 'TWEET' | 'THREAD' | 'CHART' | 'MICRO_CASE' | 'INSIGHT';
export type DraftStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface DistributionDraft {
    id: string;
    organizationId: string;
    signalId: string | null;
    format: DraftFormat;
    content: string;
    editedContent: string | null;
    status: DraftStatus;
    publishedAt: string | null;
    platform: string | null;
    impressions: number | null;
    engagement: number | null;
    createdAt: string;
    updatedAt: string;
    signal?: {
        id: string;
        type: string;
        confidence: number;
        insight: string;
    } | null;
}

export const distributionApi = {
    async list(params?: {
        page?: number;
        limit?: number;
        status?: DraftStatus;
        format?: DraftFormat;
    }): Promise<{
        items: DistributionDraft[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const response = await api.get('/distribution', { params });
        return {
            items: response.data.data,
            meta: response.data.meta,
        };
    },

    async getById(id: string): Promise<DistributionDraft> {
        const response = await api.get(`/distribution/${id}`);
        return response.data.data;
    },

    async exportChart(id: string): Promise<{
        format: 'png';
        filename: string;
        url: string;
    }> {
        const response = await api.get(`/distribution/${id}/export`);
        return response.data.data;
    },

    async generate(input: { signalId: string; formats?: DraftFormat[] }): Promise<{
        created: DistributionDraft[];
    }> {
        const response = await api.post('/distribution/generate', input);
        return response.data.data;
    },

    async update(id: string, input: {
        editedContent?: string;
        status?: DraftStatus;
        platform?: string;
    }): Promise<DistributionDraft> {
        const response = await api.patch(`/distribution/${id}`, input);
        return response.data.data;
    },

    async publish(id: string, input?: { platform?: string }): Promise<DistributionDraft> {
        const response = await api.post(`/distribution/${id}/publish`, input || {});
        return response.data.data;
    },

    async track(id: string, input: { impressions?: number; engagement?: number }): Promise<DistributionDraft> {
        const response = await api.post(`/distribution/${id}/track`, input);
        return response.data.data;
    },
};

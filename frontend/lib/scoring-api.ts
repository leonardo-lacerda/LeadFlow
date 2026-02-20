import { api } from '@/lib/api';

export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';
export type RecommendedAction = 'EMAIL' | 'WHATSAPP' | 'CALL' | 'REVIEW';

export interface LeadScoreBreakdown {
    enrichment: number;
    interaction: number;
    timing: number;
    icp: number;
}

export interface LeaderboardLead {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    companyName: string | null;
    jobTitle: string | null;
    score: number;
    temperature: LeadTemperature;
    status: string;
    lastInteraction: string | null;
    scoreBreakdown: LeadScoreBreakdown | null;
    recommendedAction: RecommendedAction;
}

export const scoringApi = {
    async getLeaderboard(params?: {
        limit?: number;
        temperature?: LeadTemperature;
    }): Promise<LeaderboardLead[]> {
        const response = await api.get('/scoring/leaderboard', { params });
        return response.data.data;
    },

    async recalculate(payload?: {
        leadIds?: string[];
        limit?: number;
    }): Promise<{ jobId: string; queued: boolean; leadCount: number }> {
        const response = await api.post('/scoring/recalculate', payload ?? {});
        return response.data.data;
    },
};

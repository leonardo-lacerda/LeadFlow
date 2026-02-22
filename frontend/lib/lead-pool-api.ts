import { api } from '@/lib/api';

export interface SharedLeadItem {
    id: string;
    googlePlaceId: string | null;
    companyCnpj: string | null;
    linkedinUrl: string | null;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    companyName: string | null;
    website: string | null;
    city: string | null;
    state: string | null;
    category: string | null;
    source: string;
    quality: number;
    confirmations: number;
    lastScrapedAt: string;
    claimed: boolean;
    claimedLeadId: string | null;
}

export const leadPoolApi = {
    async search(params?: {
        city?: string;
        state?: string;
        category?: string;
        source?: string;
        freshnessDays?: number;
        page?: number;
        limit?: number;
    }): Promise<{
        items: SharedLeadItem[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const response = await api.get('/lead-pool/search', { params });
        return {
            items: response.data.data,
            meta: response.data.meta,
        };
    },

    async claim(input: { sharedLeadId: string; leadId?: string; scrapingJobId?: string }): Promise<{
        leadId: string | null;
    }> {
        const response = await api.post('/lead-pool/claim', input);
        return response.data.data;
    },

    async getStats(): Promise<{
        sharedLeads: number;
        sharedLeads30d: number;
        orgClaims: number;
        claimedWithLead: number;
    }> {
        const response = await api.get('/lead-pool/stats');
        return response.data.data;
    },
};

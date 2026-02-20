import { api } from "@/lib/api";

export interface CreateCampaignStep {
    type: "EMAIL" | "WHATSAPP" | "WAIT" | "CONDITION";
    subject?: string;
    content: string;
    delayHours?: number;
}

export interface CreateCampaignData {
    name: string;
    type: "EMAIL" | "WHATSAPP" | "MULTI_CHANNEL";
    leadIds: string[];
    steps: CreateCampaignStep[];
    settings?: unknown;
    schedule?: unknown;
}

export interface Campaign {
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    settings?: Record<string, unknown>;
    schedule?: Record<string, unknown>;
    steps: Array<{
        id: string;
        type: string;
        subject?: string | null;
        content: string;
        delayHours: number;
    }>;
    leads: Array<{
        id: string;
        status: string;
        currentStep: number;
        lastActivityAt: string | null;
        lead?: {
            id: string;
            fullName: string;
            email: string;
            companyName?: string | null;
            jobTitle?: string | null;
        };
    }>;
    stats?: {
        totalLeads: number;
        completedLeads: number;
        repliedLeads: number;
        conversionRate: number;
    };
}

export interface CampaignLeadItem {
    id: string;
    status: string;
    currentStep: number;
    lastActivityAt: string | null;
    lead: {
        id: string;
        fullName: string;
        email: string;
        companyName: string | null;
        jobTitle: string | null;
        phone: string | null;
    };
}

export interface CampaignAnalytics {
    leadStats: Array<{ status: string; _count: { _all: number } }>;
    totals: {
        sent: number;
        delivered: number;
        opened: number;
        replied: number;
    };
    stepStats: Record<string, { sent: number; replied: number; opened: number; clicked: number }>;
    templateStats: Record<string, { sent: number; replied: number; opened: number; clicked: number }>;
    abTests: Record<string, { sent: number; replied: number; opened: number; clicked: number }>;
    daily: Record<string, number>;
}

export const campaignsApi = {
    async create(data: CreateCampaignData): Promise<Campaign> {
        const response = await api.post("/campaigns", data);
        return response.data.data;
    },

    async list(params?: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        type?: string;
    }): Promise<{ campaigns: Campaign[]; total: number }> {
        const response = await api.get("/campaigns", { params });
        return {
            campaigns: response.data.data,
            total: response.data.meta.total,
        };
    },

    async getById(id: string): Promise<Campaign> {
        const response = await api.get(`/campaigns/${id}`);
        return response.data.data;
    },

    async updateStatus(
        id: string,
        status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED"
    ): Promise<Campaign> {
        const response = await api.patch(`/campaigns/${id}/status`, { status });
        return response.data.data;
    },

    async getAnalytics(id: string): Promise<CampaignAnalytics> {
        const response = await api.get(`/campaigns/${id}/analytics`);
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/campaigns/${id}`);
    },

    async getCampaignLeads(
        id: string,
        params: {
            page?: number;
            limit?: number;
            search?: string;
            status?: string;
        } = {}
    ): Promise<{
        leads: CampaignLeadItem[];
        total: number;
    }> {
        const response = await api.get(`/campaigns/${id}/leads`, { params });
        return response.data.data;
    },
};

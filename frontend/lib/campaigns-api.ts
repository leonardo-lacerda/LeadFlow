import { api } from "@/lib/api";

export type CampaignType = "EMAIL" | "WHATSAPP" | "MULTI_CHANNEL";
export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
export type CampaignStepType = "EMAIL" | "WHATSAPP" | "WAIT" | "CONDITION";
export type CampaignLeadStatus =
    | "PENDING"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "REPLIED"
    | "BOUNCED"
    | "UNSUBSCRIBED"
    | "PAUSED";

export interface CreateCampaignStep {
    type: CampaignStepType;
    subject?: string;
    content: string;
    delayHours?: number;
    delayDays?: number;
    templateId?: string;
}

export interface CreateCampaignData {
    name: string;
    type: CampaignType;
    leadIds: string[];
    steps: CreateCampaignStep[];
    settings?: unknown;
    schedule?: unknown;
}

export interface Campaign {
    id: string;
    name: string;
    type: CampaignType;
    status: CampaignStatus;
    createdAt: string;
    updatedAt: string;
    settings?: Record<string, unknown>;
    schedule?: Record<string, unknown>;
    steps: Array<{
        id: string;
        order: number;
        type: CampaignStepType;
        subject?: string | null;
        content: string;
        templateId?: string | null;
        delayDays: number;
        delayHours: number;
        createdAt?: string;
    }>;
    leads: Array<{
        id: string;
        status: CampaignLeadStatus;
        currentStep: number;
        nextActionAt?: string | null;
        lastActivityAt: string | null;
        createdAt?: string;
        updatedAt?: string;
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
    status: CampaignLeadStatus;
    currentStep: number;
    nextActionAt?: string | null;
    lastActivityAt: string | null;
    createdAt?: string;
    updatedAt?: string;
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
        status?: CampaignStatus;
        type?: CampaignType;
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

    async updateStatus(id: string, status: CampaignStatus): Promise<Campaign> {
        const response = await api.patch(`/campaigns/${id}/status`, { status });
        return response.data.data;
    },

    async launch(id: string): Promise<void> {
        await api.post(`/campaigns/${id}/launch`);
    },

    async pause(id: string): Promise<void> {
        await api.post(`/campaigns/${id}/pause`);
    },

    async resume(id: string): Promise<void> {
        await api.post(`/campaigns/${id}/resume`);
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
        return {
            leads: response.data.data,
            total: response.data.meta.total,
        };
    },

    async addLeads(id: string, leadIds: string[]): Promise<{ created: number }> {
        const response = await api.post(`/campaigns/${id}/leads`, { leadIds });
        return response.data.data;
    },
};

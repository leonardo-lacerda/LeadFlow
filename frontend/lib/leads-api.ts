import { api } from "@/lib/api";

export interface Lead {
    id: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    whatsapp?: string | null;
    linkedinUrl?: string | null;
    companyName: string | null;
    companyDomain?: string | null;
    companyCnpj?: string | null;
    companySize?: string | null;
    companyRevenue?: string | null;
    companyEmployees?: string | null;
    industry?: string | null;
    jobTitle: string | null;
    seniority?: string | null;
    department?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    source?: string | null;
    sourceUrl?: string | null;
    status: string;
    tags: string[];
    technologies?: string[];
    maturityLevel?: "EARLY_STAGE" | "GROWING" | "ESTABLISHED" | "ENTERPRISE" | null;
    icpReasons?: string[];
    score?: number | null;
    icpMatch?: number | null;
    temperature?: "HOT" | "WARM" | "COLD";
    lastInteraction?: string | null;
    lastScoreUpdate?: string | null;
    scoreBreakdown?: {
        enrichment: number;
        interaction: number;
        timing: number;
        icp: number;
    } | null;
    enrichmentData?: Record<string, unknown> | null;
    assignedToUserId?: string | null;
    inboxStarred?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LeadInput {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    emailVerified?: boolean;
    phone?: string;
    whatsapp?: string;
    linkedinUrl?: string;
    companyName?: string;
    companyDomain?: string;
    companyCnpj?: string;
    companySize?: string;
    companyRevenue?: string;
    companyEmployees?: string;
    industry?: string;
    jobTitle?: string;
    seniority?: string;
    department?: string;
    city?: string;
    state?: string;
    country?: string;
    score?: number;
    icpMatch?: number;
    source?: string;
    sourceUrl?: string;
    tags?: string[];
    technologies?: string[];
    maturityLevel?: "EARLY_STAGE" | "GROWING" | "ESTABLISHED" | "ENTERPRISE";
    icpReasons?: string[];
    status?: string;
    assignedToUserId?: string | null;
    inboxStarred?: boolean;
}

export interface LeadListResponse {
    data: Lead[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const leadsApi = {
    async list(params?: {
        page?: number;
        limit?: number;
        search?: string;
        tags?: string[];
        status?: string;
        source?: string;
    }): Promise<LeadListResponse> {
        const response = await api.get("/leads", { params });
        return response.data;
    },

    async getById(id: string): Promise<Lead> {
        const response = await api.get(`/leads/${id}`);
        return response.data.data;
    },

    async create(data: LeadInput): Promise<Lead> {
        const response = await api.post("/leads", data);
        return response.data.data;
    },

    async update(id: string, data: Partial<LeadInput>): Promise<Lead> {
        const response = await api.patch(`/leads/${id}`, data);
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/leads/${id}`);
    },

    async bulkCreate(leads: LeadInput[]): Promise<{ created: number }> {
        const response = await api.post("/leads/bulk", { leads });
        return response.data.data;
    },
};

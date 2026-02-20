import { api } from "@/lib/api";

export type ScrapingSource =
    | 'google_maps'
    | 'cnpj'
    | 'reclame_aqui'
    | 'indeed'
    | 'catho'
    | 'mercado_livre'
    | 'wappalyzer'
    | 'linkedin_dork'
    | 'comprasnet';

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ScrapingJob {
    id: string;
    name: string;
    source: ScrapingSource;
    query: Record<string, unknown>;
    status: JobStatus;
    progress: number;
    totalItems: number;
    processedItems: number;
    leadsCreated: number;
    errors?: Record<string, unknown>;
    schedule?: string;
    lastRunAt?: string;
    nextRunAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ScrapingJobLead {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    whatsapp?: string | null;
    linkedinUrl?: string | null;
    companyName: string | null;
    companyDomain?: string | null;
    jobTitle: string | null;
    city?: string | null;
    state?: string | null;
    sourceUrl?: string | null;
    enrichmentData?: Record<string, unknown> | null;
    status: string;
    createdAt: string;
}

export interface CreateJobInput {
    name?: string;
    source: ScrapingSource;
    query: Record<string, unknown>;
    webhookUrl?: string;
    schedule?: string;
}

export const scrapingApi = {
    async listJobs(params?: { page?: number; limit?: number }): Promise<{
        jobs: ScrapingJob[];
        total: number;
        totalPages: number;
    }> {
        const response = await api.get("/scraping/jobs", { params });
        return {
            jobs: response.data.data,
            total: response.data.meta.total,
            totalPages: response.data.meta.totalPages,
        };
    },

    async getJob(id: string): Promise<ScrapingJob> {
        const response = await api.get(`/scraping/jobs/${id}`);
        return response.data.data;
    },

    async listJobLeads(
        id: string,
        params?: { page?: number; limit?: number; search?: string }
    ): Promise<{ leads: ScrapingJobLead[]; total: number; totalPages: number }> {
        const response = await api.get(`/scraping/jobs/${id}/leads`, { params });
        return {
            leads: response.data.data,
            total: response.data.meta.total,
            totalPages: response.data.meta.totalPages,
        };
    },

    async createJob(input: CreateJobInput): Promise<ScrapingJob> {
        const response = await api.post("/scraping/jobs", input);
        return response.data.data;
    },

    async rerunJob(id: string): Promise<void> {
        await api.post(`/scraping/jobs/${id}/run`);
    },

    async cancelJob(id: string): Promise<void> {
        await api.post(`/scraping/jobs/${id}/cancel`);
    },
};

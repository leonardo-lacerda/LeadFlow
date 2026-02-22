import { api } from "@/lib/api";

export type EnrichmentJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface EnrichmentJob {
    id: string;
    name: string;
    query?: Record<string, unknown> | null;
    processedLeadIds?: string[];
    status: EnrichmentJobStatus;
    progress: number;
    totalItems: number;
    processedItems: number;
    leadsEnriched: number;
    errors?: Record<string, unknown> | null;
    lastRunAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ScrapingLeadReference {
    id: string;
}

async function listAllScrapingLeadIds(scrapingJobId: string): Promise<string[]> {
    const leadIds: string[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        const response = await api.get(`/scraping/jobs/${scrapingJobId}/leads`, {
            params: { page, limit: 100 },
        });
        const leads = (response.data?.data || []) as ScrapingLeadReference[];
        leadIds.push(...leads.map((lead) => lead.id));
        totalPages = Number(response.data?.meta?.totalPages || 1);
        page += 1;
    } while (page <= totalPages);

    return Array.from(new Set(leadIds));
}

export const enrichmentApi = {
    async createJob(input: {
        leadIds: string[];
        name?: string;
        webhookUrl?: string;
    }): Promise<EnrichmentJob> {
        const response = await api.post("/enrichment/jobs", input);
        return response.data.data;
    },

    async listJobs(params?: {
        page?: number;
        limit?: number;
    }): Promise<{
        jobs: EnrichmentJob[];
        total: number;
        totalPages: number;
    }> {
        const response = await api.get("/enrichment/jobs", { params });
        return {
            jobs: response.data.data,
            total: response.data.meta.total,
            totalPages: response.data.meta.totalPages,
        };
    },

    async getJob(id: string): Promise<EnrichmentJob> {
        const response = await api.get(`/enrichment/jobs/${id}`);
        return response.data.data;
    },

    async createJobForScrapingJob(
        scrapingJobId: string,
        options?: { name?: string; webhookUrl?: string }
    ): Promise<EnrichmentJob> {
        const leadIds = await listAllScrapingLeadIds(scrapingJobId);
        if (leadIds.length === 0) {
            throw new Error("Nenhum lead encontrado para esta tarefa de scraping");
        }

        return this.createJob({
            leadIds,
            name: options?.name || `Enrichment ${scrapingJobId}`,
            webhookUrl: options?.webhookUrl,
        });
    },
};

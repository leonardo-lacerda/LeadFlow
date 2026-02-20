import { api } from "@/lib/api";

export interface LeadNote {
    id: string;
    leadId: string;
    userId?: string | null;
    content: string;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
    } | null;
}

export const notesApi = {
    async list(leadId: string): Promise<LeadNote[]> {
        const response = await api.get(`/leads/${leadId}/notes`);
        return response.data.data;
    },

    async create(leadId: string, content: string): Promise<LeadNote> {
        const response = await api.post(`/leads/${leadId}/notes`, { content });
        return response.data.data;
    },

    async remove(leadId: string, noteId: string): Promise<void> {
        await api.delete(`/leads/${leadId}/notes/${noteId}`);
    },
};

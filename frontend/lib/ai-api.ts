import { api } from "@/lib/api";

export interface AiGenerateResponse {
    variants: Array<{
        subject?: string;
        body?: string;
        message?: string;
    }>;
}

export const aiApi = {
    async generateMessage(input: {
        type: "email" | "whatsapp";
        lead: Record<string, unknown>;
        tone?: string;
        language?: string;
        variants?: number;
    }): Promise<AiGenerateResponse> {
        const response = await api.post("/ai/generate", input);
        const payload = response.data?.data?.data || response.data?.data;
        return payload as AiGenerateResponse;
    },
};

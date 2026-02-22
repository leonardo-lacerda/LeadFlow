import { api } from "@/lib/api";

export interface AiGenerateResponse {
    variants: Array<{
        subject?: string;
        body?: string;
        message?: string;
    }>;
}

export interface AiPrompt {
    id: string;
    name: string;
    category?: string;
    description?: string;
    variables?: string[];
    content?: string;
}

type AnalyzeInput = {
    message: string;
    tone?: string;
    language?: string;
    promptId?: string;
};

function unwrapAiData<T>(raw: unknown): T {
    let current = raw;
    for (let depth = 0; depth < 3; depth += 1) {
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            return current as T;
        }
        if (!("data" in current)) {
            return current as T;
        }
        current = (current as { data: unknown }).data;
    }
    return current as T;
}

export const aiApi = {
    async generateMessage(input: {
        type: "email" | "whatsapp";
        lead: Record<string, unknown>;
        tone?: string;
        language?: string;
        variants?: number;
        promptId?: string;
    }): Promise<AiGenerateResponse> {
        const response = await api.post("/ai/generate", input);
        return unwrapAiData<AiGenerateResponse>(response.data);
    },

    async analyzeIntent(input: AnalyzeInput): Promise<Record<string, unknown>> {
        const response = await api.post("/ai/analyze/intent", input);
        return unwrapAiData<Record<string, unknown>>(response.data);
    },

    async analyzeSentiment(input: AnalyzeInput): Promise<Record<string, unknown>> {
        const response = await api.post("/ai/analyze/sentiment", input);
        return unwrapAiData<Record<string, unknown>>(response.data);
    },

    async listPrompts(): Promise<AiPrompt[]> {
        const response = await api.get("/ai/prompts");
        const payload = unwrapAiData<unknown>(response.data);
        if (Array.isArray(payload)) {
            return payload as AiPrompt[];
        }
        if (payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown[] }).items)) {
            return (payload as { items: AiPrompt[] }).items;
        }
        return [];
    },
};

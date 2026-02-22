import { api } from "@/lib/api";

export type SocialPlatform = "TWITTER" | "LINKEDIN";
export type SocialPublishStatus = "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface IntegrationStatus {
    twitterConnected: boolean;
    linkedinConnected: boolean;
    twitter: {
        connected: boolean;
        expiresAt: string | null;
        hasRefreshToken: boolean;
        scope: string | null;
    };
    linkedin: {
        connected: boolean;
        expiresAt: string | null;
        hasRefreshToken: boolean;
        scope: string | null;
        authorUrn: string | null;
    };
    publishQueue: {
        queued: number;
        processing: number;
        failed: number;
        success: number;
    };
}

export interface OAuthStartResponse {
    state: string;
    authorizationUrl: string;
}

export interface PublishJobItem {
    id: string;
    organizationId: string;
    draftId: string | null;
    platform: SocialPlatform;
    content: string;
    status: SocialPublishStatus;
    attempts: number;
    maxAttempts: number;
    externalPostId: string | null;
    errorMessage: string | null;
    queuedAt: string;
    processedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PublishJobsResponse {
    items: PublishJobItem[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const growthApi = {
    async getIntegrationStatus(): Promise<IntegrationStatus> {
        const response = await api.get("/integrations/status");
        return response.data.data;
    },

    async startTwitterOAuth(returnTo = "/growth"): Promise<OAuthStartResponse> {
        const response = await api.get("/integrations/twitter/oauth/start", {
            params: { returnTo },
        });
        return response.data.data;
    },

    async startLinkedinOAuth(returnTo = "/growth"): Promise<OAuthStartResponse> {
        const response = await api.get("/integrations/linkedin/oauth/start", {
            params: { returnTo },
        });
        return response.data.data;
    },

    async disconnectTwitter(): Promise<void> {
        await api.post("/integrations/twitter/disconnect");
    },

    async disconnectLinkedin(): Promise<void> {
        await api.post("/integrations/linkedin/disconnect");
    },

    async publishTwitter(input: {
        content: string;
        draftId?: string;
        maxAttempts?: number;
    }): Promise<{ jobId: string; status: SocialPublishStatus; platform: SocialPlatform; queuedAt: string }> {
        const response = await api.post("/integrations/twitter/publish", input);
        return response.data.data;
    },

    async publishLinkedin(input: {
        content: string;
        draftId?: string;
        maxAttempts?: number;
    }): Promise<{ jobId: string; status: SocialPublishStatus; platform: SocialPlatform; queuedAt: string }> {
        const response = await api.post("/integrations/linkedin/publish", input);
        return response.data.data;
    },

    async listPublishJobs(input?: {
        page?: number;
        limit?: number;
        platform?: SocialPlatform;
        status?: SocialPublishStatus;
    }): Promise<PublishJobsResponse> {
        const response = await api.get("/integrations/publish-jobs", {
            params: input || {},
        });
        return response.data.data;
    },

    async retryPublishJob(id: string): Promise<PublishJobItem> {
        const response = await api.post(`/integrations/publish-jobs/${id}/retry`);
        return response.data.data;
    },
};

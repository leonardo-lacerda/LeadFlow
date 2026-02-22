import { api } from '@/lib/api';

export const growthApi = {
    async getIntegrationStatus(): Promise<{
        twitterConnected: boolean;
        linkedinConnected: boolean;
    }> {
        const response = await api.get('/integrations/status');
        return response.data.data;
    },

    async publishTwitter(input: { content: string; draftId?: string }): Promise<{
        platform: string;
        postId: string;
        publishedAt: string;
        preview: string;
        mode: string;
    }> {
        const response = await api.post('/integrations/twitter/publish', input);
        return response.data.data;
    },

    async publishLinkedin(input: { content: string; draftId?: string }): Promise<{
        platform: string;
        postId: string;
        publishedAt: string;
        preview: string;
        mode: string;
    }> {
        const response = await api.post('/integrations/linkedin/publish', input);
        return response.data.data;
    },
};

import { api } from "@/lib/api";
import { LeadTemperature } from "@/lib/scoring-api";

export interface InboxConversation {
    id: string; // lead id
    lead: {
        id: string;
        fullName: string;
        email: string;
        avatar?: string | null;
        companyName?: string | null;
        assignedToUserId?: string | null;
        inboxStarred?: boolean;
        temperature?: LeadTemperature;
    };
    lastMessage: {
        id: string;
        content: string;
        createdAt: string;
        direction: 'INBOUND' | 'OUTBOUND';
        type: 'EMAIL' | 'WHATSAPP';
        status: string;
    } | null;
    unreadCount: number;
}

export interface InboxMessage {
    id: string;
    content: string;
    createdAt: string;
    direction: 'INBOUND' | 'OUTBOUND';
    type: 'EMAIL' | 'WHATSAPP';
    status: string;
    subject?: string;
    metadata?: Record<string, unknown> | null;
}

export interface InboxLead {
    id: string;
    fullName: string;
    email: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    companyName?: string | null;
    jobTitle?: string | null;
    city?: string | null;
    state?: string | null;
    status?: string | null;
    assignedToUserId?: string | null;
    inboxStarred?: boolean;
    temperature?: LeadTemperature;
}

export type InboxObjectionType =
    | "PRICE"
    | "TIMING"
    | "AUTHORITY"
    | "COMPETITOR"
    | "NO_INTEREST"
    | "TRUST"
    | "OTHER";

export interface InboxObjection {
    type: InboxObjectionType;
    confidence: number;
    matchedKeywords: string[];
}

export interface InboxReplySuggestion {
    id: string;
    label: string;
    content: string;
}

export interface InboxFollowup {
    action: "ALERT_SDR" | "AUTO_FOLLOWUP" | "NURTURE" | "NONE";
    delayHours: number;
    reason: string;
    overdue: boolean;
    hoursSinceLastOutbound: number | null;
}

export interface InboxIntelligence {
    leadId: string;
    temperature: LeadTemperature;
    hotLead: boolean;
    objection: InboxObjection | null;
    suggestions: InboxReplySuggestion[];
    followup: InboxFollowup;
    latestInbound: {
        id: string;
        content: string;
        channel: "EMAIL" | "WHATSAPP";
        createdAt: string;
    } | null;
}

export const inboxApi = {
    async listConversations(params?: {
        page?: number;
        limit?: number;
        status?: 'UNREAD' | 'ALL';
        channel?: 'EMAIL' | 'WHATSAPP';
        search?: string;
    }): Promise<{ conversations: InboxConversation[]; total: number }> {
        const response = await api.get("/inbox/conversations", { params });
        return {
            conversations: response.data.data,
            total: response.data.meta.total,
        };
    },

    async getThread(
        leadId: string,
        params?: { page?: number; limit?: number }
    ): Promise<{ messages: InboxMessage[]; total: number; lead: InboxLead }> {
        const response = await api.get(`/inbox/${leadId}/messages`, { params });
        return response.data.data;
    },

    async sendMessage(
        leadId: string,
        data: { content: string; type: 'EMAIL' | 'WHATSAPP'; subject?: string }
    ): Promise<InboxMessage> {
        const response = await api.post(`/inbox/${leadId}/messages`, data);
        return response.data.data;
    },

    async markAsRead(leadId: string): Promise<void> {
        await api.patch(`/inbox/${leadId}/read`);
    },

    async markAsUnread(leadId: string): Promise<void> {
        await api.patch(`/inbox/${leadId}/unread`);
    },

    async getIntelligence(leadId: string): Promise<InboxIntelligence> {
        const response = await api.get(`/inbox/${leadId}/intelligence`);
        return response.data.data;
    },

    async recalculateFollowups(): Promise<{ jobId: string }> {
        const response = await api.post("/inbox/followups/recalculate");
        return response.data.data;
    },
};

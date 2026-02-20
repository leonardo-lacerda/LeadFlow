import { api } from "@/lib/api";

export interface Mailbox {
    id: string;
    name: string;
    email: string;
    dailyLimit: number;
    isActive: boolean;
    isWarming: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
}

export interface WhatsappInstance {
    id: string;
    name: string;
    instanceName: string;
    status: string;
    dailyLimit: number;
    isActive: boolean;
}

export interface CreateMailboxInput {
    name: string;
    email: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    imapHost?: string;
    imapPort?: number;
    imapUser?: string;
    imapPass?: string;
    dailyLimit?: number;
}

export interface CreateWhatsappInput {
    name: string;
    instanceName?: string;
    dailyLimit?: number;
}

export const integrationsApi = {
    // Mailboxes
    async listMailboxes(): Promise<Mailbox[]> {
        const response = await api.get("/email/mailboxes");
        return response.data.data;
    },

    async createMailbox(data: CreateMailboxInput): Promise<Mailbox> {
        const response = await api.post("/email/mailboxes", data);
        return response.data.data;
    },

    async deleteMailbox(id: string): Promise<void> {
        await api.delete(`/email/mailboxes/${id}`);
    },

    // WhatsApp
    async listWhatsapp(): Promise<WhatsappInstance[]> {
        const response = await api.get("/whatsapp/instances");
        return response.data.data;
    },

    async createWhatsapp(data: CreateWhatsappInput): Promise<WhatsappInstance> {
        const response = await api.post("/whatsapp/instances", data);
        return response.data.data;
    },

    async deleteWhatsapp(id: string): Promise<void> {
        await api.delete(`/whatsapp/instances/${id}`);
    },

    async getQrCode(id: string): Promise<string> {
        const response = await api.post(`/whatsapp/instances/${id}/qr`);
        return response.data.data.qrCode;
    },

    // API Keys (via Organization)
    async updateApiKeys(keys: Record<string, string>): Promise<void> {
        await api.patch("/organization", { apiKeys: keys });
    },

    async updateWebhooks(hooks: Record<string, string>): Promise<void> {
        await api.patch("/organization", { webhooks: hooks });
    }
};

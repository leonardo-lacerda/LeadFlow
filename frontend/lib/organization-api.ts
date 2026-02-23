import { api } from "@/lib/api";

export interface User {
    id: string;
    name: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: string;
    planVersion?: number;
    onboardingCompleted?: boolean;
    networkOptIn?: boolean;
    apiKeys?: Record<string, string>;
    webhooks?: Record<string, string>;
    notificationSettings?: Record<string, unknown>;
    icpDefinition?: Record<string, unknown>;
    leadsUsed?: number;
    emailsUsed?: number;
    whatsappUsed?: number;
    enrichmentsUsed?: number;
    leadsLimit?: number;
    emailsLimit?: number;
    whatsappLimit?: number;
    enrichmentsLimit?: number;
    users: User[];
    _count: {
        leads: number;
        campaigns: number;
    };
}

export interface UpdateOrganizationInput {
    name?: string;
    icpDefinition?: Record<string, unknown>;
    apiKeys?: Record<string, string>;
    webhooks?: Record<string, string>;
    onboardingCompleted?: boolean;
    notificationSettings?: Record<string, unknown>;
    networkOptIn?: boolean;
}

export interface InviteUserInput {
    email: string;
    role: "ADMIN" | "MEMBER";
}

export interface InviteUserResponse {
    email: string;
    role: "ADMIN" | "MEMBER";
    expiresAt: string;
    inviteUrl: string;
}

export const organizationApi = {
    async getOrganization(): Promise<Organization> {
        const response = await api.get("/organization");
        return response.data.data;
    },

    async updateOrganization(data: UpdateOrganizationInput): Promise<Organization> {
        const response = await api.patch("/organization", data);
        return response.data.data;
    },

    async inviteUser(data: InviteUserInput): Promise<InviteUserResponse> {
        const response = await api.post("/organization/users", data);
        return response.data.data;
    },

    async removeUser(userId: string): Promise<void> {
        await api.delete(`/organization/users/${userId}`);
    },
};

import { api } from "@/lib/api";

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    read: boolean;
    link?: string;
    createdAt: string;
}

export interface NotificationsResponse {
    success: boolean;
    data: Notification[];
    meta: {
        unreadCount: number;
    };
}

export const notificationsApi = {
    async list(): Promise<NotificationsResponse> {
        const response = await api.get("/notifications");
        return response.data;
    },

    async markRead(id: string): Promise<void> {
        await api.patch(`/notifications/${id}/read`);
    },

    async markAllRead(): Promise<void> {
        await api.patch("/notifications/read-all");
    },
};

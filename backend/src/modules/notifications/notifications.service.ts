import { prisma } from '../../lib/prisma.js';

interface CreateNotificationInput {
    organizationId: string;
    userId?: string;
    title: string;
    message: string;
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    link?: string;
}

export const notificationService = {
    async create(data: CreateNotificationInput) {
        return prisma.notification.create({
            data: {
                organizationId: data.organizationId,
                userId: data.userId,
                title: data.title,
                message: data.message,
                type: data.type || 'INFO',
                link: data.link,
            },
        });
    },

    async list(organizationId: string, userId: string, limit = 20) {
        return prisma.notification.findMany({
            where: {
                organizationId,
                OR: [
                    { userId: userId },
                    { userId: null } // Global org notifications
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    },

    async countUnread(organizationId: string, userId: string) {
        return prisma.notification.count({
            where: {
                organizationId,
                read: false,
                OR: [
                    { userId: userId },
                    { userId: null }
                ]
            },
        });
    },

    async markAsRead(id: string, organizationId: string) {
        return prisma.notification.updateMany({
            where: {
                id,
                organizationId
            },
            data: { read: true },
        });
    },

    async markAllAsRead(organizationId: string, userId: string) {
        return prisma.notification.updateMany({
            where: {
                organizationId,
                read: false,
                OR: [
                    { userId: userId },
                    { userId: null }
                ]
            },
            data: { read: true },
        });
    }
};

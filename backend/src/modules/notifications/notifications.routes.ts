import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { notificationService } from './notifications.service.js';

export async function notificationRoutes(fastify: FastifyInstance) {
    // List notifications
    fastify.get(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string, userId: string }>();
                const notifications = await notificationService.list(decoded.organizationId, decoded.userId);
                const unreadCount = await notificationService.countUnread(decoded.organizationId, decoded.userId);

                return reply.send({
                    success: true,
                    data: notifications,
                    meta: { unreadCount }
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch notifications',
                });
            }
        }
    );

    // Mark as read
    fastify.patch<{ Params: { id: string } }>(
        '/:id/read',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await notificationService.markAsRead(request.params.id, decoded.organizationId);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: 'Failed to mark as read',
                });
            }
        }
    );

    // Mark all as read
    fastify.patch(
        '/read-all',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string, userId: string }>();
                await notificationService.markAllAsRead(decoded.organizationId, decoded.userId);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: 'Failed to mark all as read',
                });
            }
        }
    );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { inboxService } from './inbox.service.js';
import { inboxIntelligenceService } from './inbox-intelligence.service.js';
import { z } from 'zod';

const listConversationsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    status: z.enum(['UNREAD', 'ALL']).optional(),
    channel: z.enum(['EMAIL', 'WHATSAPP']).optional(),
    search: z.string().optional(),
});

const sendMessageSchema = z
    .object({
        content: z.string().min(1),
        type: z.enum(['EMAIL', 'WHATSAPP']).optional(),
        channel: z.enum(['EMAIL', 'WHATSAPP']).optional(),
        subject: z.string().optional(),
    })
    .refine((data) => data.type || data.channel, {
        message: 'type is required',
        path: ['type'],
    });

export async function inboxRoutes(fastify: FastifyInstance) {
    // List conversations
    fastify.get(
        '/conversations',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listConversationsSchema.parse(request.query);

                const result = await inboxService.listConversations(decoded.organizationId, query);

                return reply.send({
                    success: true,
                    data: result.conversations,
                    meta: {
                        page: query.page,
                        limit: query.limit,
                        total: result.total,
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list conversations',
                });
            }
        }
    );

    // Get thread messages
    fastify.get(
        '/:leadId/messages',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { leadId: string };
                const query = request.query as { page?: string; limit?: string };
                const { leadId } = params;
                const { page = '1', limit = '50' } = query;

                const result = await inboxService.getThread(
                    decoded.organizationId,
                    leadId,
                    parseInt(page),
                    parseInt(limit)
                );

                return reply.send({
                    success: true,
                    data: result,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get thread',
                });
            }
        }
    );

    // Get intelligence insights for a thread
    fastify.get(
        '/:leadId/intelligence',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { leadId: string };
                const result = await inboxIntelligenceService.getThreadIntelligence(
                    decoded.organizationId,
                    params.leadId
                );
                return reply.send({
                    success: true,
                    data: result,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to load thread intelligence',
                });
            }
        }
    );

    // Send message
    fastify.post(
        '/:leadId/messages',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { leadId: string };
                const body = sendMessageSchema.parse(request.body);
                const type = body.type ?? body.channel;
                const message = await inboxService.sendMessage(decoded.organizationId, params.leadId, {
                    content: body.content,
                    type: type || 'EMAIL',
                    subject: body.subject,
                });
                return reply.code(201).send({ success: true, data: message });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to send message',
                });
            }
        }
    );

    // Enqueue follow-up scan manually
    fastify.post(
        '/followups/recalculate',
        {
            onRequest: [fastify.authenticate],
        },
        async (_request: FastifyRequest, reply: FastifyReply) => {
            try {
                const result = await inboxIntelligenceService.enqueueFollowUpScan();
                return reply.code(202).send({
                    success: true,
                    data: result,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error:
                        error instanceof Error ? error.message : 'Failed to enqueue follow-up scan',
                });
            }
        }
    );

    // Mark conversation as read
    fastify.patch(
        '/:leadId/read',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { leadId: string };
                const { leadId } = params;

                const result = await inboxService.markAsRead(decoded.organizationId, leadId);

                return reply.send({
                    success: true,
                    data: result,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to mark as read',
                });
            }
        }
    );

    // Mark conversation as unread
    fastify.patch(
        '/:leadId/unread',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { leadId: string };
                const result = await inboxService.markAsUnread(decoded.organizationId, params.leadId);
                return reply.send({
                    success: true,
                    data: result,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to mark as unread',
                });
            }
        }
    );
}

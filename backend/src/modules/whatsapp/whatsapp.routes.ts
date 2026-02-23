import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { whatsappService } from './whatsapp.service.js';
import { env } from '../../config/env.js';
import { assertTrustedWebhookUrl } from '../../lib/webhook-url.js';
import { sendLimitAwareError } from '../billing/http.js';

const createInstanceSchema = z.object({
    name: z.string().min(1),
    instanceName: z.string().min(1).optional(),
    dailyLimit: z.coerce.number().int().min(1).optional(),
    webhookUrl: z.string().url().optional(),
});

const updateInstanceSchema = z.object({
    name: z.string().min(1).optional(),
    dailyLimit: z.coerce.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
});

const listInstancesSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

const sendWhatsAppSchema = z
    .object({
        leadIds: z.array(z.string().min(1)).min(1),
        message: z.string().optional(),
        templateId: z.string().optional(),
        instanceId: z.string().optional(),
        mediaUrl: z.string().url().optional(),
        mediaType: z.enum(['image', 'document', 'video']).optional(),
    })
    .refine((data) => Boolean(data.message || data.templateId), {
        message: 'message or templateId is required',
        path: ['message'],
    });

export async function whatsappRoutes(fastify: FastifyInstance) {
    fastify.post(
        '/instances',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = createInstanceSchema.parse(request.body);
                if (body.webhookUrl) {
                    assertTrustedWebhookUrl(body.webhookUrl);
                }
                const instance = await whatsappService.createInstance(decoded.organizationId, body);
                return reply.code(201).send({ success: true, data: instance });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create instance',
                });
            }
        }
    );

    fastify.get(
        '/instances',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listInstancesSchema.parse(request.query);
                const result = await whatsappService.listInstances(decoded.organizationId, query);
                return reply.send({
                    success: true,
                    data: result.instances,
                    meta: {
                        page: query.page,
                        limit: query.limit,
                        total: result.total,
                        totalPages: Math.ceil(result.total / query.limit),
                    },
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list instances',
                });
            }
        }
    );

    fastify.get(
        '/instances/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const instance = await whatsappService.getInstance(
                    decoded.organizationId,
                    (request.params as { id: string }).id
                );
                if (!instance) {
                    return reply.code(404).send({ success: false, error: 'Instance not found' });
                }
                return reply.send({ success: true, data: instance });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get instance',
                });
            }
        }
    );

    fastify.patch(
        '/instances/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = updateInstanceSchema.parse(request.body);
                const result = await whatsappService.updateInstance(
                    decoded.organizationId,
                    (request.params as { id: string }).id,
                    body
                );
                if (result.count === 0) {
                    return reply.code(404).send({ success: false, error: 'Instance not found' });
                }
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update instance',
                });
            }
        }
    );

    fastify.delete(
        '/instances/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await whatsappService.deleteInstance(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete instance',
                });
            }
        }
    );

    fastify.post(
        '/instances/:id/qr',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const qrCode = await whatsappService.refreshQr(
                    decoded.organizationId,
                    (request.params as { id: string }).id
                );
                return reply.send({ success: true, data: { qrCode } });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to refresh QR code',
                });
            }
        }
    );

    fastify.get(
        '/instances/:id/status',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const status = await whatsappService.getConnectionState(
                    decoded.organizationId,
                    (request.params as { id: string }).id
                );
                return reply.send({ success: true, data: { status } });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch status',
                });
            }
        }
    );

    fastify.post(
        '/send',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = sendWhatsAppSchema.parse(request.body);
                const result = await whatsappService.queueSend(decoded.organizationId, body);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Failed to send WhatsApp');
            }
        }
    );

    fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            if (env.WHATSAPP_WEBHOOK_SECRET) {
                const provided = request.headers['x-whatsapp-secret'];
                const providedValue = Array.isArray(provided) ? provided[0] : provided;
                if (providedValue !== env.WHATSAPP_WEBHOOK_SECRET) {
                    return reply.code(401).send({
                        success: false,
                        error: 'Unauthorized',
                    });
                }
            }

            const payload = request.body as Record<string, unknown>;
            await whatsappService.handleWebhook(payload);
            return reply.send({ success: true });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process webhook',
            });
        }
    });
}

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import dns from 'node:dns/promises';
import { env } from '../../config/env.js';
import { emailService } from './email.service.js';
import { isAllowedTrackingUrl, verifyClickSignature } from './email.utils.js';

const createMailboxSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    smtpHost: z.string().min(1),
    smtpPort: z.coerce.number().int().min(1),
    smtpUser: z.string().min(1),
    smtpPass: z.string().min(1),
    imapHost: z.string().optional(),
    imapPort: z.coerce.number().int().min(1).optional(),
    imapUser: z.string().optional(),
    imapPass: z.string().optional(),
    dailyLimit: z.coerce.number().int().min(1).optional(),
    isWarming: z.boolean().optional(),
});

const updateMailboxSchema = createMailboxSchema.partial().extend({
    isActive: z.boolean().optional(),
});

const listMailboxSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

const sendEmailSchema = z.object({
    leadIds: z.array(z.string().min(1)).min(1),
    subject: z.string().optional(),
    content: z.string().optional(),
    templateId: z.string().optional(),
    mailboxId: z.string().optional(),
});

const webhookSchema = z.object({
    messageId: z.string(),
    leadId: z.string().optional(),
    error: z.any().optional(),
});

function decodeBase64Url(value: string) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    return Buffer.from(padded, 'base64').toString('utf-8');
}

function hasValidEmailWebhookSecret(request: FastifyRequest) {
    if (!env.EMAIL_WEBHOOK_SECRET) {
        return true;
    }
    const provided = request.headers['x-email-secret'];
    const providedValue = Array.isArray(provided) ? provided[0] : provided;
    return providedValue === env.EMAIL_WEBHOOK_SECRET;
}

export async function emailRoutes(fastify: FastifyInstance) {
    // Mailboxes CRUD
    fastify.post(
        '/mailboxes',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = createMailboxSchema.parse(request.body);
                const mailbox = await emailService.createMailbox(decoded.organizationId, body);
                return reply.code(201).send({ success: true, data: mailbox });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create mailbox',
                });
            }
        }
    );

    fastify.get(
        '/mailboxes',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listMailboxSchema.parse(request.query);
                const result = await emailService.listMailboxes(decoded.organizationId, query);
                return reply.send({
                    success: true,
                    data: result.mailboxes,
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
                    error: error instanceof Error ? error.message : 'Failed to list mailboxes',
                });
            }
        }
    );

    fastify.get(
        '/mailboxes/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const mailbox = await emailService.getMailbox(
                    decoded.organizationId,
                    (request.params as { id: string }).id
                );
                if (!mailbox) {
                    return reply.code(404).send({ success: false, error: 'Mailbox not found' });
                }
                return reply.send({ success: true, data: mailbox });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get mailbox',
                });
            }
        }
    );

    fastify.patch(
        '/mailboxes/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = updateMailboxSchema.parse(request.body);
                await emailService.updateMailbox(decoded.organizationId, (request.params as { id: string }).id, body);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update mailbox',
                });
            }
        }
    );

    fastify.delete(
        '/mailboxes/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await emailService.deleteMailbox(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete mailbox',
                });
            }
        }
    );

    fastify.post(
        '/mailboxes/:id/test',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await emailService.testMailbox((request.params as { id: string }).id, decoded.organizationId);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to test mailbox',
                });
            }
        }
    );

    fastify.post(
        '/mailboxes/:id/warmup',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await emailService.advanceWarmup(decoded.organizationId, (request.params as { id: string }).id);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to advance warmup',
                });
            }
        }
    );

    // Send email
    fastify.post(
        '/send',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = sendEmailSchema.parse(request.body);
                const result = await emailService.queueSend(decoded.organizationId, body);
                return reply.send({ success: true, data: result });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to send email',
                });
            }
        }
    );

    // Tracking pixel
    fastify.get(
        '/track/open',
        async (request: FastifyRequest, reply) => {
            const query = request.query as { messageId?: string };
            const messageId = query.messageId;
            if (messageId) {
                await emailService.handleOpen(messageId);
            }
            const pixel = Buffer.from(
                'R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=',
                'base64'
            );
            reply.type('image/gif').send(pixel);
        }
    );

    // Click tracking
    fastify.get(
        '/track/click',
        async (request: FastifyRequest, reply) => {
            const query = request.query as { messageId?: string; url?: string; sig?: string };
            const messageId = query.messageId;
            const encodedUrl = query.url || '';
            const signature = query.sig;
            if (!messageId || !encodedUrl) {
                return reply.code(400).send({ success: false, error: 'Invalid tracking payload' });
            }

            if (!verifyClickSignature(messageId, encodedUrl, signature)) {
                return reply.code(400).send({ success: false, error: 'Invalid tracking signature' });
            }

            let targetUrl = '';
            try {
                targetUrl = decodeBase64Url(encodedUrl);
            } catch {
                return reply.code(400).send({ success: false, error: 'Invalid url encoding' });
            }

            if (!isAllowedTrackingUrl(targetUrl)) {
                return reply.code(400).send({ success: false, error: 'Disallowed redirect domain' });
            }

            await emailService.handleClick(messageId);
            return reply.redirect(targetUrl);
        }
    );

    // Unsubscribe
    fastify.get(
        '/unsubscribe',
        async (request: FastifyRequest, reply) => {
            const query = request.query as { messageId?: string };
            const messageId = query.messageId;
            if (!messageId) {
                return reply.code(400).send({ success: false, error: 'messageId is required' });
            }
            await emailService.handleUnsubscribe(messageId);
            return reply.send({
                success: true,
                message: 'You have been unsubscribed.',
            });
        }
    );

    // Webhooks
    fastify.post('/webhook/bounce', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            if (!hasValidEmailWebhookSecret(request)) {
                return reply.code(401).send({ success: false, error: 'Unauthorized' });
            }
            const body = webhookSchema.parse(request.body);
            await emailService.handleBounce(body.messageId, body.error);
            return reply.send({ success: true });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to handle bounce',
            });
        }
    });

    fastify.post('/webhook/complaint', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            if (!hasValidEmailWebhookSecret(request)) {
                return reply.code(401).send({ success: false, error: 'Unauthorized' });
            }
            const body = webhookSchema.parse(request.body);
            await emailService.handleComplaint(body.messageId, body.error);
            return reply.send({ success: true });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to handle complaint',
            });
        }
    });

    // DKIM/SPF validation
    fastify.get(
        '/domain-check',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply) => {
            try {
                const query = request.query as { domain?: string; selector?: string };
                const domain = query.domain;
                const selector = query.selector;
                if (!domain) {
                    return reply.code(400).send({ success: false, error: 'domain is required' });
                }

                const txtRecords = await dns.resolveTxt(domain);
                const spf = txtRecords.flat().some((record) => record.toLowerCase().includes('v=spf1'));

                let dkim = false;
                if (selector) {
                    try {
                        const dkimRecords = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
                        dkim = dkimRecords.flat().some((record) => record.toLowerCase().includes('v=dkim1'));
                    } catch {
                        dkim = false;
                    }
                }

                return reply.send({ success: true, data: { spf, dkim } });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to validate domain',
                });
            }
        }
    );
}

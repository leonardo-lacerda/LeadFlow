import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { Prisma, SignalEventType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { emailQueue } from '../../lib/queue.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';
import { inboxIntelligenceService } from '../inbox/inbox-intelligence.service.js';
import { signalLayerService } from '../signals/signal-layer.service.js';
import {
    injectLinkTracking,
    injectTrackingPixel,
    injectUnsubscribe,
    renderTemplate,
    stripHtml,
} from './email.utils.js';

interface CreateMailboxInput {
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
    isWarming?: boolean;
}

interface UpdateMailboxInput extends Partial<CreateMailboxInput> {
    isActive?: boolean;
}

interface SendEmailInput {
    leadIds: string[];
    subject?: string;
    content?: string;
    templateId?: string;
    mailboxId?: string;
    metadata?: Record<string, unknown>;
}

interface ListMailboxQuery {
    page: number;
    limit: number;
}

const EMAIL_FIELDS = new Set([
    'firstName',
    'lastName',
    'fullName',
    'email',
    'phone',
    'whatsapp',
    'linkedinUrl',
    'companyName',
    'companyDomain',
    'companyCnpj',
    'companySize',
    'industry',
    'jobTitle',
    'seniority',
    'department',
    'city',
    'state',
    'country',
    'tags',
]);

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function getEffectiveDailyLimit(mailbox: {
    dailyLimit: number;
    isWarming: boolean;
    warmupDay: number;
}) {
    if (!mailbox.isWarming) {
        return mailbox.dailyLimit;
    }
    const warmupLimit = Math.max(5, mailbox.warmupDay * 10);
    return Math.min(mailbox.dailyLimit, warmupLimit);
}

const MAILBOX_PUBLIC_SELECT = {
    id: true,
    organizationId: true,
    email: true,
    name: true,
    smtpHost: true,
    smtpPort: true,
    smtpUser: true,
    imapHost: true,
    imapPort: true,
    imapUser: true,
    isWarming: true,
    warmupDay: true,
    dailyLimit: true,
    sentToday: true,
    isActive: true,
    lastUsedAt: true,
    createdAt: true,
} satisfies Prisma.MailboxSelect;

function decryptMailboxCredentials<T extends { smtpPass: string; imapPass: string | null }>(mailbox: T) {
    return {
        ...mailbox,
        smtpPass: decryptSecret(mailbox.smtpPass) || mailbox.smtpPass,
        imapPass: mailbox.imapPass ? decryptSecret(mailbox.imapPass) || mailbox.imapPass : null,
    };
}

export class EmailService {
    async createMailbox(organizationId: string, input: CreateMailboxInput) {
        return prisma.mailbox.create({
            data: {
                organizationId,
                name: input.name,
                email: input.email,
                smtpHost: input.smtpHost,
                smtpPort: input.smtpPort,
                smtpUser: input.smtpUser,
                smtpPass: encryptSecret(input.smtpPass) || input.smtpPass,
                imapHost: input.imapHost,
                imapPort: input.imapPort,
                imapUser: input.imapUser,
                imapPass: input.imapPass ? encryptSecret(input.imapPass) || input.imapPass : undefined,
                dailyLimit: input.dailyLimit ?? 50,
                isWarming: input.isWarming ?? false,
            },
            select: MAILBOX_PUBLIC_SELECT,
        });
    }

    async listMailboxes(organizationId: string, query: ListMailboxQuery) {
        const skip = (query.page - 1) * query.limit;
        const [mailboxes, total] = await Promise.all([
            prisma.mailbox.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: query.limit,
                select: MAILBOX_PUBLIC_SELECT,
            }),
            prisma.mailbox.count({ where: { organizationId } }),
        ]);
        return { mailboxes, total };
    }

    async getMailbox(organizationId: string, mailboxId: string) {
        return prisma.mailbox.findFirst({
            where: { id: mailboxId, organizationId },
            select: MAILBOX_PUBLIC_SELECT,
        });
    }

    async updateMailbox(
        organizationId: string,
        mailboxId: string,
        input: UpdateMailboxInput
    ) {
        const data: Prisma.MailboxUpdateManyMutationInput = {
            ...input,
        };

        if (typeof input.smtpPass === 'string') {
            data.smtpPass = encryptSecret(input.smtpPass) || input.smtpPass;
        }

        if (typeof input.imapPass === 'string') {
            data.imapPass = encryptSecret(input.imapPass) || input.imapPass;
        }

        return prisma.mailbox.updateMany({
            where: { id: mailboxId, organizationId },
            data,
        });
    }

    async advanceWarmup(organizationId: string, mailboxId: string) {
        return prisma.mailbox.updateMany({
            where: { id: mailboxId, organizationId },
            data: {
                isWarming: true,
                warmupDay: { increment: 1 },
            },
        });
    }

    async deleteMailbox(organizationId: string, mailboxId: string) {
        return prisma.mailbox.deleteMany({
            where: { id: mailboxId, organizationId },
        });
    }

    async testMailbox(mailboxId: string, organizationId: string) {
        const mailbox = await prisma.mailbox.findFirst({
            where: { id: mailboxId, organizationId },
        });
        if (!mailbox) {
            throw new Error('Mailbox not found');
        }
        const credentials = decryptMailboxCredentials(mailbox);

        const transport = nodemailer.createTransport({
            host: credentials.smtpHost,
            port: credentials.smtpPort,
            secure: credentials.smtpPort === 465,
            auth: {
                user: credentials.smtpUser,
                pass: credentials.smtpPass,
            },
        });

        await transport.verify();

        if (credentials.imapHost && credentials.imapUser && credentials.imapPass) {
            const client = new ImapFlow({
                host: credentials.imapHost,
                port: credentials.imapPort || 993,
                secure: (credentials.imapPort || 993) === 993,
                auth: {
                    user: credentials.imapUser,
                    pass: credentials.imapPass,
                },
            });
            await client.connect();
            await client.logout();
        }

        return true;
    }

    async queueSend(organizationId: string, input: SendEmailInput) {
        const leads = await prisma.lead.findMany({
            where: { id: { in: input.leadIds }, organizationId },
        });

        if (leads.length === 0) {
            throw new Error('No leads found');
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                emailsLimit: true,
                emailsUsed: true,
            },
        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        const remaining = organization.emailsLimit - organization.emailsUsed;
        if (remaining < leads.length) {
            throw new Error('Email limit exceeded');
        }

        const template = input.templateId
            ? await prisma.template.findFirst({
                  where: { id: input.templateId, organizationId },
              })
            : null;

        const subject = input.subject || template?.subject || '';
        const content = input.content || template?.content || '';

        if (!subject || !content) {
            throw new Error('Subject and content are required');
        }

        let queued = 0;
        let failed = 0;

        for (const lead of leads) {
            if (!lead.email) {
                const failedMessage = await prisma.message.create({
                    data: {
                        type: 'EMAIL',
                        direction: 'OUTBOUND',
                        subject,
                        content,
                        status: 'FAILED',
                        leadId: lead.id,
                        metadata: {
                            ...(input.metadata || {}),
                            error: 'Lead without email',
                        },
                    },
                });
                await signalLayerService.trackMessageEvent({
                    messageId: failedMessage.id,
                    eventType: SignalEventType.MESSAGE_FAILED,
                    metadata: {
                        source: 'email.queue_send',
                        reason: 'lead_without_email',
                    },
                });
                failed += 1;
                continue;
            }

            const mailbox = await this.selectMailbox(organizationId, input.mailboxId);
            const campaignStepId =
                input.metadata && typeof input.metadata['stepId'] === 'string'
                    ? input.metadata['stepId']
                    : undefined;

            const message = await prisma.message.create({
                data: {
                    type: 'EMAIL',
                    direction: 'OUTBOUND',
                    subject,
                    content,
                    status: 'QUEUED',
                    leadId: lead.id,
                    mailboxId: mailbox.id,
                    campaignStepId,
                    metadata: {
                        templateId: input.templateId,
                        ...(input.metadata || {}),
                    },
                },
            });

            await emailQueue.add('send', { messageId: message.id });
            queued += 1;
        }

        return { queued, failed };
    }

    async selectMailbox(organizationId: string, mailboxId?: string) {
        if (mailboxId) {
            const mailbox = await prisma.mailbox.findFirst({
                where: { id: mailboxId, organizationId, isActive: true },
            });
            if (!mailbox) {
                throw new Error('Mailbox not found');
            }
            const mailboxWithReset = await this.resetIfNewDay(decryptMailboxCredentials(mailbox));
            const limit = getEffectiveDailyLimit(mailboxWithReset);
            if (mailboxWithReset.sentToday >= limit) {
                throw new Error('Daily limit reached for mailbox');
            }
            return mailboxWithReset;
        }

        const mailboxes = await prisma.mailbox.findMany({
            where: { organizationId, isActive: true },
        });

        if (mailboxes.length === 0) {
            throw new Error('No active mailboxes');
        }

        const candidates: Array<(typeof mailboxes)[number]> = [];
        for (const mailbox of mailboxes) {
            const reset = await this.resetIfNewDay(decryptMailboxCredentials(mailbox));
            const limit = getEffectiveDailyLimit(reset);
            if (reset.sentToday < limit) {
                candidates.push(reset);
            }
        }

        if (candidates.length === 0) {
            throw new Error('All mailboxes reached daily limit');
        }

        candidates.sort((a, b) => {
            const ratioA = a.sentToday / getEffectiveDailyLimit(a);
            const ratioB = b.sentToday / getEffectiveDailyLimit(b);
            if (ratioA === ratioB) {
                return (a.lastUsedAt?.getTime() || 0) - (b.lastUsedAt?.getTime() || 0);
            }
            return ratioA - ratioB;
        });

        return candidates[0];
    }

    async resetIfNewDay<T extends { id: string; sentToday: number; lastUsedAt: Date | null }>(
        mailbox: T
    ): Promise<T> {
        if (mailbox.lastUsedAt && !isSameDay(mailbox.lastUsedAt, new Date())) {
            await prisma.mailbox.update({
                where: { id: mailbox.id },
                data: { sentToday: 0 },
            });
            return {
                ...mailbox,
                sentToday: 0,
            };
        }
        return mailbox;
    }

    async sendMessage(messageId: string) {
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
                lead: true,
                mailbox: true,
            },
        });

        if (!message || !message.mailbox) {
            throw new Error('Message or mailbox not found');
        }
        const mailbox = decryptMailboxCredentials(message.mailbox);

        if (!message.lead.email) {
            throw new Error('Lead email missing');
        }

        const organization = await prisma.organization.findUnique({
            where: { id: message.lead.organizationId },
        });

        const templateData = {
            lead: this.pickFields(message.lead),
            organization: organization ? { id: organization.id, name: organization.name } : null,
        };

        const subject = renderTemplate(message.subject || '', templateData);
        let html = renderTemplate(message.content || '', templateData);

        html = injectTrackingPixel(html, message.id);
        html = injectLinkTracking(html, message.id);
        html = injectUnsubscribe(html, message.id);

        const text = stripHtml(html);

        const transport = nodemailer.createTransport({
            host: mailbox.smtpHost,
            port: mailbox.smtpPort,
            secure: mailbox.smtpPort === 465,
            auth: {
                user: mailbox.smtpUser,
                pass: mailbox.smtpPass,
            },
        });

        const effectiveLimit = getEffectiveDailyLimit(mailbox);
        if (mailbox.sentToday >= effectiveLimit) {
            throw new Error('Daily limit reached for mailbox');
        }

        const domain = mailbox.email.split('@')[1] || 'leadflow.local';
        const customMessageId = `<leadflow-${message.id}@${domain}>`;

        const result = await transport.sendMail({
            from: `${mailbox.name} <${mailbox.email}>`,
            to: message.lead.email,
            subject,
            html,
            text,
            messageId: customMessageId,
            headers: {
                'X-Leadflow-Message-Id': message.id,
                'List-Unsubscribe': `<${env.API_BASE_URL || `http://${env.HOST}:${env.PORT}`}/api/email/unsubscribe?messageId=${message.id}>`,
            },
        });

        const baseMetadata =
            message.metadata && typeof message.metadata === 'object'
                ? (message.metadata as Record<string, unknown>)
                : {};

        await prisma.message.update({
            where: { id: message.id },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                metadata: {
                    ...baseMetadata,
                    smtpMessageId: result.messageId,
                },
            },
        });

        await prisma.mailbox.update({
            where: { id: message.mailbox.id },
            data: {
                sentToday: { increment: 1 },
                lastUsedAt: new Date(),
            },
        });

        await prisma.organization.update({
            where: { id: message.lead.organizationId },
            data: { emailsUsed: { increment: 1 } },
        });

        await signalLayerService.trackMessageEvent({
            messageId: message.id,
            eventType: SignalEventType.MESSAGE_SENT,
            metadata: {
                source: 'email.send',
                providerMessageId: result.messageId,
            },
        });

        return result;
    }

    async handleOpen(messageId: string) {
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return null;
        }
        if (!message.openedAt) {
            await prisma.message.update({
                where: { id: messageId },
                data: {
                    openedAt: new Date(),
                    status: message.status === 'SENT' ? 'OPENED' : message.status,
                },
            });
        }
        return true;
    }

    async handleClick(messageId: string) {
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return null;
        }
        await prisma.message.update({
            where: { id: messageId },
            data: {
                clickedAt: new Date(),
                status: message.status === 'SENT' || message.status === 'OPENED' ? 'CLICKED' : message.status,
            },
        });
        return true;
    }

    async handleUnsubscribe(messageId: string) {
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return null;
        }
        await prisma.lead.updateMany({
            where: { id: message.leadId },
            data: { status: 'UNSUBSCRIBED' },
        });
        await prisma.message.update({
            where: { id: messageId },
            data: {
                status: message.status,
                metadata: {
                    ...(message.metadata && typeof message.metadata === 'object'
                        ? (message.metadata as Record<string, unknown>)
                        : {}),
                    unsubscribed: true,
                },
            },
        });
        await this.updateCampaignLeadStatus(message.metadata, 'UNSUBSCRIBED');
        return true;
    }

    async handleBounce(messageId: string, error?: unknown) {
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return null;
        }
        await prisma.message.update({
            where: { id: messageId },
            data: {
                status: 'BOUNCED',
                bouncedAt: new Date(),
                metadata: {
                    ...(message.metadata && typeof message.metadata === 'object'
                        ? (message.metadata as Record<string, unknown>)
                        : {}),
                    error: error ? String(error) : undefined,
                },
            },
        });
        await prisma.lead.updateMany({
            where: { id: message.leadId },
            data: { status: 'BOUNCED' },
        });
        await this.updateCampaignLeadStatus(message.metadata, 'BOUNCED');
        await signalLayerService.trackMessageEvent({
            messageId,
            eventType: SignalEventType.MESSAGE_BOUNCED,
            metadata: {
                source: 'email.webhook_bounce',
                reason: error ? String(error) : 'bounce',
            },
        });
        return true;
    }

    async handleComplaint(messageId: string, error?: unknown) {
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return null;
        }
        await prisma.message.update({
            where: { id: messageId },
            data: {
                status: 'FAILED',
                metadata: {
                    ...(message.metadata && typeof message.metadata === 'object'
                        ? (message.metadata as Record<string, unknown>)
                        : {}),
                    complaint: true,
                    error: error ? String(error) : undefined,
                },
            },
        });
        await prisma.lead.updateMany({
            where: { id: message.leadId },
            data: { status: 'UNSUBSCRIBED' },
        });
        await this.updateCampaignLeadStatus(message.metadata, 'UNSUBSCRIBED');
        await signalLayerService.trackMessageFailure(
            messageId,
            error ? String(error) : 'complaint'
        );
        return true;
    }

    pickFields(lead: Record<string, unknown>) {
        return Object.fromEntries(
            Object.entries(lead).filter(([key]) => EMAIL_FIELDS.has(key))
        );
    }

    async processInbound(
        mailbox: {
            id: string;
            organizationId: string;
        },
        fromEmail: string,
        subject: string,
        content: string
    ) {
        const lead = await prisma.lead.findFirst({
            where: { email: fromEmail, organizationId: mailbox.organizationId },
        });
        if (!lead) {
            return null;
        }

        const latestOutbound = await prisma.message.findFirst({
            where: {
                leadId: lead.id,
                direction: 'OUTBOUND',
                type: 'EMAIL',
            },
            orderBy: { createdAt: 'desc' },
        });

        if (latestOutbound) {
            const repliedAt = new Date();
            const outboundTimestamp = latestOutbound.sentAt || latestOutbound.createdAt;
            const responseTime = Math.max(
                0,
                Math.round((repliedAt.getTime() - outboundTimestamp.getTime()) / 1000)
            );

            await prisma.message.update({
                where: { id: latestOutbound.id },
                data: {
                    status: 'REPLIED',
                    repliedAt,
                    responseTime,
                },
            });
            await this.updateCampaignLeadStatus(latestOutbound.metadata, 'REPLIED');
        }

        const inboundMessage = await prisma.message.create({
            data: {
                type: 'EMAIL',
                direction: 'INBOUND',
                subject,
                content,
                status: 'REPLIED',
                leadId: lead.id,
                mailboxId: mailbox.id,
            },
        });

        await signalLayerService.trackMessageEvent({
            messageId: inboundMessage.id,
            eventType: SignalEventType.MESSAGE_REPLY_RECEIVED,
            metadata: {
                source: 'email.inbound',
            },
        });

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                status: 'REPLIED',
                lastInteraction: new Date(),
            },
        });

        try {
            await inboxIntelligenceService.handleInboundLeadReply({
                organizationId: mailbox.organizationId,
                leadId: lead.id,
                content,
                channel: 'EMAIL',
            });
        } catch (error) {
            console.warn('Inbox intelligence failed for inbound email:', error);
        }

        return lead;
    }

    async updateCampaignLeadStatus(
        metadata: unknown,
        status: 'REPLIED' | 'BOUNCED' | 'UNSUBSCRIBED'
    ) {
        if (!metadata) {
            return;
        }
        const meta = metadata as Record<string, unknown>;
        const campaignLeadId = meta['campaignLeadId'] as string | undefined;
        if (!campaignLeadId) {
            return;
        }
        await prisma.campaignLead.updateMany({
            where: { id: campaignLeadId },
            data: { status },
        });
    }
}

export const emailService = new EmailService();

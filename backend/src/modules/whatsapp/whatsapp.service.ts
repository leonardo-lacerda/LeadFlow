import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { whatsappQueue } from '../../lib/queue.js';
import { fetchWithTimeout } from '../../lib/fetch.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';
import { inboxIntelligenceService } from '../inbox/inbox-intelligence.service.js';
import { getApiBaseUrl, normalizePhone, renderTemplate } from './whatsapp.utils.js';

interface CreateInstanceInput {
    name: string;
    instanceName?: string;
    dailyLimit?: number;
    webhookUrl?: string;
}

interface UpdateInstanceInput {
    name?: string;
    dailyLimit?: number;
    isActive?: boolean;
}

interface SendWhatsAppInput {
    leadIds: string[];
    message?: string;
    templateId?: string;
    instanceId?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'document' | 'video';
    metadata?: Record<string, unknown>;
}

interface ListInstancesQuery {
    page: number;
    limit: number;
}

type EvolutionResponse = Record<string, unknown>;

const WHATSAPP_PUBLIC_SELECT = {
    id: true,
    organizationId: true,
    name: true,
    phone: true,
    instanceName: true,
    status: true,
    qrCode: true,
    lastConnectedAt: true,
    isActive: true,
    dailyLimit: true,
    sentToday: true,
    createdAt: true,
} satisfies Prisma.WhatsappInstanceSelect;

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

async function evolutionRequest(
    path: string,
    options: { method?: string; body?: Record<string, unknown> },
    instanceToken?: string
) {
    const url = `${env.EVOLUTION_API_URL}${path}`;
    const headers: Record<string, string> = {
        'content-type': 'application/json',
    };
    if (env.EVOLUTION_API_KEY) {
        headers['apikey'] = env.EVOLUTION_API_KEY;
        headers['authorization'] = `Bearer ${env.EVOLUTION_API_KEY}`;
    }
    if (instanceToken) {
        headers['x-instance-token'] = instanceToken;
        headers['instance-token'] = instanceToken;
    }

    const response = await fetchWithTimeout(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Evolution API error (${response.status}): ${text}`);
    }

    try {
        return (await response.json()) as EvolutionResponse;
    } catch {
        return {};
    }
}

function extractQrCode(payload: EvolutionResponse) {
    const direct =
        (payload['qrcode'] as string) ||
        (payload['qrCode'] as string) ||
        (payload['qr'] as string) ||
        (payload['base64'] as string);
    if (direct) {
        return direct;
    }
    const data = payload['data'];
    return typeof data === 'string' ? data : null;
}

function extractInstanceToken(payload: EvolutionResponse) {
    const direct =
        (payload['token'] as string) ||
        (payload['instanceToken'] as string) ||
        (payload['instance_token'] as string);
    if (direct) {
        return direct;
    }
    const data = payload['data'];
    if (data && typeof data === 'object') {
        const token = (data as Record<string, unknown>)['token'];
        if (typeof token === 'string') {
            return token;
        }
    }
    return null;
}

function extractExternalMessageId(payload: EvolutionResponse) {
    const direct =
        (payload['messageId'] as string) ||
        (payload['message_id'] as string) ||
        (payload['id'] as string);
    if (direct) {
        return direct;
    }
    const key = payload['key'];
    if (key && typeof key === 'object') {
        const value = (key as Record<string, unknown>)['id'];
        if (typeof value === 'string') {
            return value;
        }
    }
    return null;
}

function decryptInstanceToken(value: string) {
    return decryptSecret(value) || value;
}

export class WhatsAppService {
    async createInstance(organizationId: string, input: CreateInstanceInput) {
        const instanceName =
            input.instanceName ||
            `${input.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        const webhookUrl =
            input.webhookUrl || `${getApiBaseUrl()}/api/whatsapp/webhook`;

        const payload = {
            instanceName,
            webhook: webhookUrl,
        };

        let response: EvolutionResponse | null = null;
        try {
            response = await evolutionRequest('/instance/create', { method: 'POST', body: payload });
        } catch (error) {
            response = null;
        }

        const qrCode = response ? extractQrCode(response) : null;
        const instanceToken = response ? extractInstanceToken(response) : null;

        return prisma.whatsappInstance.create({
            data: {
                organizationId,
                name: input.name,
                instanceName,
                instanceToken: encryptSecret(instanceToken || instanceName) || instanceName,
                status: 'DISCONNECTED',
                qrCode,
                dailyLimit: input.dailyLimit ?? 100,
            },
            select: WHATSAPP_PUBLIC_SELECT,
        });
    }

    async listInstances(organizationId: string, query: ListInstancesQuery) {
        const skip = (query.page - 1) * query.limit;
        const [instances, total] = await Promise.all([
            prisma.whatsappInstance.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: query.limit,
                select: WHATSAPP_PUBLIC_SELECT,
            }),
            prisma.whatsappInstance.count({ where: { organizationId } }),
        ]);
        return { instances, total };
    }

    async getInstance(organizationId: string, instanceId: string) {
        return prisma.whatsappInstance.findFirst({
            where: { id: instanceId, organizationId },
            select: WHATSAPP_PUBLIC_SELECT,
        });
    }

    async getInstanceWithToken(organizationId: string, instanceId: string) {
        const instance = await prisma.whatsappInstance.findFirst({
            where: { id: instanceId, organizationId },
        });
        if (!instance) {
            return null;
        }
        return {
            ...instance,
            instanceToken: decryptInstanceToken(instance.instanceToken),
        };
    }

    async updateInstance(
        organizationId: string,
        instanceId: string,
        input: UpdateInstanceInput
    ) {
        return prisma.whatsappInstance.updateMany({
            where: { id: instanceId, organizationId },
            data: input,
        });
    }

    async deleteInstance(organizationId: string, instanceId: string) {
        const instance = await prisma.whatsappInstance.findFirst({
            where: { id: instanceId, organizationId },
        });
        if (!instance) {
            throw new Error('Instance not found');
        }

        return prisma.whatsappInstance.delete({
            where: { id: instanceId },
        });
    }

    async refreshQr(organizationId: string, instanceId: string) {
        const instance = await this.getInstanceWithToken(organizationId, instanceId);
        if (!instance) {
            throw new Error('Instance not found');
        }
        const response = await evolutionRequest(
            `/instance/qr/${instance.instanceName}`,
            { method: 'GET' },
            instance.instanceToken
        );
        const qrCode = extractQrCode(response);
        if (qrCode) {
            await prisma.whatsappInstance.update({
                where: { id: instance.id },
                data: {
                    qrCode,
                    status: 'CONNECTING',
                },
            });
        }
        return qrCode;
    }

    async getConnectionState(organizationId: string, instanceId: string) {
        const instance = await this.getInstanceWithToken(organizationId, instanceId);
        if (!instance) {
            throw new Error('Instance not found');
        }
        const response = await evolutionRequest(
            `/instance/connectionState/${instance.instanceName}`,
            { method: 'GET' },
            instance.instanceToken
        );
        const status = (response['state'] ||
            response['status'] ||
            response['connection'] ||
            instance.status) as string;
        const normalized = this.normalizeStatus(status);
        await prisma.whatsappInstance.update({
            where: { id: instance.id },
            data: {
                status: normalized,
                lastConnectedAt: normalized === 'CONNECTED' ? new Date() : instance.lastConnectedAt,
            },
        });
        return normalized;
    }

    async queueSend(organizationId: string, input: SendWhatsAppInput) {
        const leads = await prisma.lead.findMany({
            where: { id: { in: input.leadIds }, organizationId },
        });

        if (leads.length === 0) {
            throw new Error('No leads found');
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { whatsappLimit: true, whatsappUsed: true },
        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        const remaining = organization.whatsappLimit - organization.whatsappUsed;
        if (remaining < leads.length) {
            throw new Error('WhatsApp limit exceeded');
        }

        const template = input.templateId
            ? await prisma.template.findFirst({
                  where: { id: input.templateId, organizationId },
              })
            : null;
        const messageTemplate = input.message || template?.content || '';
        if (!messageTemplate) {
            throw new Error('Message content is required');
        }

        let queued = 0;
        let failed = 0;

        for (const lead of leads) {
            const number = lead.whatsapp || lead.phone;
            if (!number) {
                await prisma.message.create({
                    data: {
                        type: 'WHATSAPP',
                        direction: 'OUTBOUND',
                        content: messageTemplate,
                        status: 'FAILED',
                        leadId: lead.id,
                        metadata: {
                            ...(input.metadata || {}),
                            error: 'Lead without phone',
                        },
                    },
                });
                failed += 1;
                continue;
            }

            const instance = await this.selectInstance(organizationId, input.instanceId);
            const campaignStepId =
                input.metadata && typeof input.metadata['stepId'] === 'string'
                    ? input.metadata['stepId']
                    : undefined;

            const message = await prisma.message.create({
                data: {
                    type: 'WHATSAPP',
                    direction: 'OUTBOUND',
                    content: messageTemplate,
                    status: 'QUEUED',
                    leadId: lead.id,
                    campaignStepId,
                    metadata: {
                        instanceId: instance.id,
                        templateId: input.templateId,
                        mediaUrl: input.mediaUrl,
                        mediaType: input.mediaType,
                        ...(input.metadata || {}),
                    },
                },
            });

            await whatsappQueue.add('send', { messageId: message.id });
            queued += 1;
        }

        return { queued, failed };
    }

    async selectInstance(organizationId: string, instanceId?: string) {
        if (instanceId) {
            const instance = await prisma.whatsappInstance.findFirst({
                where: {
                    id: instanceId,
                    organizationId,
                    status: { not: 'BANNED' },
                    isActive: true,
                },
            });
            if (!instance) {
                throw new Error('WhatsApp instance not found');
            }
            const reset = await this.resetIfNewDay({
                ...instance,
                instanceToken: decryptInstanceToken(instance.instanceToken),
            });
            if (reset.sentToday >= reset.dailyLimit) {
                throw new Error('Daily limit reached for instance');
            }
            return reset;
        }

        const instances = await prisma.whatsappInstance.findMany({
            where: { organizationId, status: { not: 'BANNED' }, isActive: true },
        });
        if (instances.length === 0) {
            throw new Error('No WhatsApp instances');
        }

        const candidates: Array<(typeof instances)[number]> = [];
        for (const instance of instances) {
            const reset = await this.resetIfNewDay({
                ...instance,
                instanceToken: decryptInstanceToken(instance.instanceToken),
            });
            if (reset.sentToday < reset.dailyLimit) {
                candidates.push(reset);
            }
        }

        if (candidates.length === 0) {
            throw new Error('All instances reached daily limit');
        }

        candidates.sort((a, b) => {
            const ratioA = a.sentToday / (a.dailyLimit || 1);
            const ratioB = b.sentToday / (b.dailyLimit || 1);
            if (ratioA === ratioB) {
                return (a.lastConnectedAt?.getTime() || 0) - (b.lastConnectedAt?.getTime() || 0);
            }
            return ratioA - ratioB;
        });

        return candidates[0];
    }

    async resetIfNewDay<T extends { id: string; sentToday: number; lastConnectedAt: Date | null }>(
        instance: T
    ): Promise<T> {
        if (instance.lastConnectedAt && !isSameDay(instance.lastConnectedAt, new Date())) {
            await prisma.whatsappInstance.update({
                where: { id: instance.id },
                data: { sentToday: 0 },
            });
            return { ...instance, sentToday: 0 };
        }
        return instance;
    }

    async sendMessage(messageId: string) {
        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: { lead: true },
        });

        if (!message) {
            throw new Error('Message not found');
        }

        const metadata = (message.metadata || {}) as Record<string, unknown>;
        const instanceId = metadata['instanceId'] as string;
        if (!instanceId) {
            throw new Error('WhatsApp instance missing');
        }

        const instance = await prisma.whatsappInstance.findUnique({ where: { id: instanceId } });
        if (!instance) {
            throw new Error('WhatsApp instance not found');
        }
        const instanceWithToken = {
            ...instance,
            instanceToken: decryptInstanceToken(instance.instanceToken),
        };

        if (instanceWithToken.sentToday >= instanceWithToken.dailyLimit) {
            throw new Error('Daily limit reached');
        }

        const organization = await prisma.organization.findUnique({
            where: { id: message.lead.organizationId },
        });

        const templateData = {
            lead: message.lead,
            organization: organization ? { id: organization.id, name: organization.name } : null,
        };

        const content = renderTemplate(message.content || '', templateData);
        const phone = normalizePhone(message.lead.whatsapp || message.lead.phone || '');
        if (!phone) {
            throw new Error('Lead phone missing');
        }

        let response: EvolutionResponse;
        if (metadata['mediaUrl']) {
            response = await evolutionRequest(
                `/message/sendMedia/${instanceWithToken.instanceName}`,
                {
                    method: 'POST',
                    body: {
                        number: phone,
                        mediaType: metadata['mediaType'] || 'image',
                        url: metadata['mediaUrl'],
                        caption: content,
                    },
                },
                instanceWithToken.instanceToken
            );
        } else {
            response = await evolutionRequest(
                `/message/sendText/${instanceWithToken.instanceName}`,
                {
                    method: 'POST',
                    body: {
                        number: phone,
                        text: content,
                    },
                },
                instanceWithToken.instanceToken
            );
        }

        const externalId = extractExternalMessageId(response);

        await prisma.message.update({
            where: { id: message.id },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                externalId: externalId || message.externalId,
                metadata: {
                    ...(message.metadata && typeof message.metadata === 'object'
                        ? (message.metadata as Record<string, unknown>)
                        : {}),
                    evolutionResponse: response as Record<string, unknown>,
                } as Prisma.InputJsonValue,
            },
        });

        await prisma.whatsappInstance.update({
            where: { id: instanceWithToken.id },
            data: {
                sentToday: { increment: 1 },
                lastConnectedAt: new Date(),
            },
        });

        await prisma.organization.update({
            where: { id: message.lead.organizationId },
            data: { whatsappUsed: { increment: 1 } },
        });

        return response;
    }

    normalizeStatus(value: string) {
        const status = value.toUpperCase();
        if (status.includes('CONNECTED')) {
            return 'CONNECTED';
        }
        if (status.includes('CONNECTING')) {
            return 'CONNECTING';
        }
        if (status.includes('BANNED')) {
            return 'BANNED';
        }
        return 'DISCONNECTED';
    }

    async handleWebhook(payload: Record<string, unknown>) {
        const instanceName =
            (payload['instance'] as string) ||
            (payload['instanceName'] as string) ||
            (payload['instance_name'] as string) ||
            (payload['data'] as Record<string, unknown>)?.['instance'];

        if (instanceName && payload['status']) {
            const instance = await prisma.whatsappInstance.findFirst({
                where: { instanceName },
            });
            if (instance) {
                const normalized = this.normalizeStatus(String(payload['status']));
                await prisma.whatsappInstance.update({
                    where: { id: instance.id },
                    data: {
                        status: normalized,
                        lastConnectedAt: normalized === 'CONNECTED' ? new Date() : instance.lastConnectedAt,
                    },
                });
            }
        }

        const inboundMessages: Array<{ from: string; text: string }> = [];

        const directFrom = payload['from'] as string | undefined;
        const directText = (payload['text'] || payload['message'] || payload['body']) as string | undefined;
        if (directFrom && directText) {
            inboundMessages.push({ from: directFrom, text: directText });
        }

        const data = payload['data'] as Record<string, unknown> | undefined;
        const messages = (data?.['messages'] as Array<Record<string, unknown>>) || [];
        for (const msg of messages) {
            const key = msg['key'] as Record<string, unknown>;
            const remoteJid = (key?.['remoteJid'] as string) || (msg['from'] as string);
            const message = msg['message'] as Record<string, unknown>;
            const conversation =
                typeof message?.['conversation'] === 'string' ? (message['conversation'] as string) : '';
            const extended = message?.['extendedTextMessage'] as Record<string, unknown> | undefined;
            const extendedText =
                extended && typeof extended['text'] === 'string' ? (extended['text'] as string) : '';
            const text = conversation || extendedText;
            if (remoteJid && text) {
                inboundMessages.push({ from: remoteJid, text });
            }
        }

        for (const inbound of inboundMessages) {
            await this.processInbound(inbound.from, inbound.text);
        }
    }

    async processInbound(from: string, text: string) {
        const number = normalizePhone(from);
        if (!number) {
            return null;
        }

        const lead = await prisma.lead.findFirst({
            where: {
                OR: [{ phone: { contains: number } }, { whatsapp: { contains: number } }],
            },
        });

        if (!lead) {
            return null;
        }

        const latestOutbound = await prisma.message.findFirst({
            where: { leadId: lead.id, direction: 'OUTBOUND', type: 'WHATSAPP' },
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

        await prisma.message.create({
            data: {
                type: 'WHATSAPP',
                direction: 'INBOUND',
                content: text,
                status: 'REPLIED',
                leadId: lead.id,
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
                organizationId: lead.organizationId,
                leadId: lead.id,
                content: text,
                channel: 'WHATSAPP',
            });
        } catch (error) {
            console.warn('Inbox intelligence failed for inbound WhatsApp:', error);
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

export const whatsappService = new WhatsAppService();

import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { signalLayerService } from '../signals/signal-layer.service.js';

interface ListConversationsParams {
    page: number;
    limit: number;
    status?: 'UNREAD' | 'ALL';
    channel?: 'EMAIL' | 'WHATSAPP';
    search?: string;
}

class InboxService {
    async listConversations(organizationId: string, params: ListConversationsParams) {
        const { page, limit, status, channel, search } = params;
        const skip = (page - 1) * limit;

        // Base where clause for Leads that have messages
        const where: Prisma.LeadWhereInput = {
            organizationId,
            messages: {
                some: {}, // Only leads with messages
            },
            ...(search && {
                OR: [
                    { fullName: { contains: search, mode: Prisma.QueryMode.insensitive } },
                    { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
                    { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
                ],
            }),
        };

        // If filtering by channel, ensure lead has messages of that channel
        if (channel) {
            where.messages = {
                some: {
                    type: channel,
                },
            };
        }

        if (status === 'UNREAD') {
            where.messages = {
                some: {
                    ...(channel ? { type: channel } : {}),
                    direction: 'INBOUND',
                    status: { notIn: ['OPENED', 'REPLIED'] },
                },
            };
        }

        // Fetch leads with their latest message
        // Prisma doesn't support easy "group by and pick latest" relation queries efficiently in one go for pagination
        // So we might fetch leads and their latest message separately or find a way to optimize.
        // For now, simpler approach: query leads that match filters, include latest message.

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    updatedAt: 'desc', // ideally sort by last message time, but that requires more complex query
                },
                include: {
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                    _count: {
                        select: {
                            messages: {
                                where: {
                                    direction: 'INBOUND',
                                    status: { notIn: ['OPENED', 'REPLIED'] },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.lead.count({ where }),
        ]);

        // Transform to simplified conversation object
        const conversations = leads.map((lead) => ({
            id: lead.id,
            lead: {
                id: lead.id,
                fullName: lead.fullName,
                email: lead.email,
                avatar: null, // Placeholder
                companyName: lead.companyName,
                assignedToUserId: lead.assignedToUserId,
                inboxStarred: lead.inboxStarred,
                temperature: lead.temperature,
            },
            lastMessage: lead.messages[0] || null,
            unreadCount: lead._count.messages,
        }));

        // Sort by last message date if possible, otherwise it's by lead update
        conversations.sort((a, b) => {
            const timeA = a.lastMessage?.createdAt.getTime() || 0;
            const timeB = b.lastMessage?.createdAt.getTime() || 0;
            return timeB - timeA;
        });

        return {
            conversations,
            total,
        };
    }

    async getThread(organizationId: string, leadId: string, page = 1, limit = 50) {
        const skip = (page - 1) * limit;

        // Verify lead belongs to org
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new Error('Lead not found');

        const [messages, total] = await Promise.all([
            prisma.message.findMany({
                where: { leadId },
                orderBy: { createdAt: 'desc' }, // Newest first for chat UI often
                skip,
                take: limit,
            }),
            prisma.message.count({ where: { leadId } }),
        ]);

        return {
            messages: messages.reverse(), // Return chronological for display
            total,
            lead,
        };
    }
    async sendMessage(
        organizationId: string,
        leadId: string,
        data: { content: string; type: 'EMAIL' | 'WHATSAPP'; subject?: string }
    ) {
        // Verify lead belongs to org
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new Error('Lead not found');

        // Create message
        const message = await prisma.message.create({
            data: {
                leadId,
                type: data.type,
                direction: 'OUTBOUND',
                status: 'PENDING', // Worker will pick this up
                content: data.content,
                subject: data.subject,
                // We should also link to a mailbox/wa instance ideally
            },
        });

        await signalLayerService.trackManualTouchpoint({
            organizationId,
            leadId,
            channel: data.type,
            messageId: message.id,
            metadata: {
                source: 'inbox.manual_send',
            },
        });

        return message;
    }

    async markAsRead(organizationId: string, leadId: string) {
        // Verify lead belongs to org
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new Error('Lead not found');

        // Mark all INBOUND messages from this lead as READ/OPENED
        await prisma.message.updateMany({
            where: {
                leadId,
                direction: 'INBOUND',
                status: { notIn: ['OPENED', 'REPLIED'] },
            },
            data: {
                status: 'OPENED',
                openedAt: new Date(),
            },
        });

        return { success: true };
    }

    async markAsUnread(organizationId: string, leadId: string) {
        // Verify lead belongs to org
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });

        if (!lead) throw new Error('Lead not found');

        await prisma.message.updateMany({
            where: {
                leadId,
                direction: 'INBOUND',
                status: 'OPENED',
            },
            data: {
                status: 'DELIVERED',
                openedAt: null,
            },
        });

        return { success: true };
    }
}

export const inboxService = new InboxService();

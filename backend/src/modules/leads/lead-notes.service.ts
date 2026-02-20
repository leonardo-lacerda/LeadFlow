import { prisma } from '../../lib/prisma.js';

interface CreateLeadNoteInput {
    content: string;
}

class LeadNotesService {
    async list(organizationId: string, leadId: string) {
        return prisma.leadNote.findMany({
            where: {
                leadId,
                lead: {
                    organizationId,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async create(
        organizationId: string,
        leadId: string,
        data: CreateLeadNoteInput,
        userId?: string
    ) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            select: { id: true },
        });

        if (!lead) {
            throw new Error('Lead not found');
        }

        return prisma.leadNote.create({
            data: {
                content: data.content,
                leadId,
                userId,
            },
        });
    }

    async delete(organizationId: string, leadId: string, noteId: string) {
        const result = await prisma.leadNote.deleteMany({
            where: {
                id: noteId,
                leadId,
                lead: { organizationId },
            },
        });

        if (result.count === 0) {
            throw new Error('Note not found');
        }

        return true;
    }
}

export const leadNotesService = new LeadNotesService();

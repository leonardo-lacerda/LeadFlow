import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { leadsService } from './leads.service.js';
import { z } from 'zod';
import { LeadStatus } from '@prisma/client';
import { leadNotesService } from './lead-notes.service.js';

const createLeadSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fullName: z.string().optional(),
    email: z.string().email().optional(),
    emailVerified: z.boolean().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    linkedinUrl: z.string().url().optional(),
    companyName: z.string().optional(),
    companyDomain: z.string().optional(),
    companyCnpj: z.string().optional(),
    companySize: z.string().optional(),
    industry: z.string().optional(),
    jobTitle: z.string().optional(),
    seniority: z.string().optional(),
    department: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().default('BR'),
    score: z.coerce.number().int().min(0).max(100).optional(),
    icpMatch: z.coerce.number().min(0).max(1).optional(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    tags: z.array(z.string()).default([]),
    status: z.nativeEnum(LeadStatus).optional(),
    assignedToUserId: z.string().nullable().optional(),
    inboxStarred: z.boolean().optional(),
});

const bulkCreateSchema = z.object({
    leads: z.array(createLeadSchema).min(1),
});

const listLeadsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    source: z.string().optional(),
    tags: z.string().optional(), // comma-separated
});

const noteSchema = z.object({
    content: z.string().min(1),
});

export async function leadsRoutes(fastify: FastifyInstance) {
    // Create lead
    fastify.post(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = createLeadSchema.parse(request.body);

                const lead = await leadsService.create(decoded.organizationId, body);

                return reply.code(201).send({
                    success: true,
                    data: lead,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create lead',
                });
            }
        }
    );

    // List leads
    fastify.get(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = listLeadsQuerySchema.parse(request.query);

                const result = await leadsService.list(decoded.organizationId, query);

                return reply.send({
                    success: true,
                    data: result.leads,
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
                    error: error instanceof Error ? error.message : 'Failed to list leads',
                });
            }
        }
    );

    // Bulk create leads
    fastify.post(
        '/bulk',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = bulkCreateSchema.parse(request.body);
                const result = await leadsService.bulkCreate(decoded.organizationId, body.leads);
                return reply.code(201).send({
                    success: true,
                    data: result,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to bulk create leads',
                });
            }
        }
    );

    // Lead notes
    fastify.get(
        '/:id/notes',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const leadId = (request.params as { id: string }).id;
                const notes = await leadNotesService.list(decoded.organizationId, leadId);
                return reply.send({ success: true, data: notes });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list notes',
                });
            }
        }
    );

    fastify.post(
        '/:id/notes',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string; userId: string }>();
                const leadId = (request.params as { id: string }).id;
                const body = noteSchema.parse(request.body);
                const note = await leadNotesService.create(
                    decoded.organizationId,
                    leadId,
                    body,
                    decoded.userId
                );
                return reply.code(201).send({ success: true, data: note });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create note',
                });
            }
        }
    );

    fastify.delete(
        '/:id/notes/:noteId',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const params = request.params as { id: string; noteId: string };
                await leadNotesService.delete(decoded.organizationId, params.id, params.noteId);
                return reply.send({ success: true });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete note',
                });
            }
        }
    );

    // Get lead by ID
    fastify.get(
        '/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const lead = await leadsService.getById(decoded.organizationId, (request.params as { id: string }).id);

                if (!lead) {
                    return reply.code(404).send({
                        success: false,
                        error: 'Lead not found',
                    });
                }

                return reply.send({
                    success: true,
                    data: lead,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to get lead',
                });
            }
        }
    );

    // Update lead
    fastify.patch(
        '/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = createLeadSchema.partial().parse(request.body);

                const lead = await leadsService.update(
                    decoded.organizationId,
                    (request.params as { id: string }).id,
                    body
                );

                return reply.send({
                    success: true,
                    data: lead,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update lead',
                });
            }
        }
    );

    // Delete lead
    fastify.delete(
        '/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                await leadsService.delete(decoded.organizationId, (request.params as { id: string }).id);

                return reply.send({
                    success: true,
                    message: 'Lead deleted successfully',
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete lead',
                });
            }
        }
    );
}

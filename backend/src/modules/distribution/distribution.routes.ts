import { DraftFormat, DraftStatus } from '@prisma/client';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { distributionService } from './distribution.service.js';

const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.nativeEnum(DraftStatus).optional(),
    format: z.nativeEnum(DraftFormat).optional(),
});

const draftParamsSchema = z.object({
    id: z.string().min(1),
});

const generateBodySchema = z.object({
    signalId: z.string().min(1),
    formats: z.array(z.nativeEnum(DraftFormat)).optional(),
});

const updateBodySchema = z.object({
    editedContent: z.string().optional(),
    status: z.nativeEnum(DraftStatus).optional(),
    platform: z.string().optional(),
});

const publishBodySchema = z.object({
    platform: z.string().optional(),
});

const trackBodySchema = z.object({
    impressions: z.coerce.number().int().min(0).optional(),
    engagement: z.coerce.number().int().min(0).optional(),
});

async function getOrganizationId(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ organizationId: string }>();
    return decoded.organizationId;
}

export async function distributionRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = listQuerySchema.parse(request.query ?? {});
                const data = await distributionService.listDrafts(organizationId, query);
                return reply.send({ success: true, data: data.items, meta: data.meta });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to list distribution drafts',
                });
            }
        }
    );

    fastify.get(
        '/:id/export',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = draftParamsSchema.parse(request.params ?? {});
                const data = await distributionService.getDraftExportAsset(
                    organizationId,
                    params.id
                );
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to export draft',
                });
            }
        }
    );

    fastify.get(
        '/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = draftParamsSchema.parse(request.params ?? {});
                const data = await distributionService.getDraftById(organizationId, params.id);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(404).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load distribution draft',
                });
            }
        }
    );

    fastify.post(
        '/generate',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const body = generateBodySchema.parse(request.body ?? {});
                const data = await distributionService.generateDrafts(organizationId, body);
                return reply.code(201).send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to generate drafts',
                });
            }
        }
    );

    fastify.patch(
        '/:id',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = draftParamsSchema.parse(request.params ?? {});
                const body = updateBodySchema.parse(request.body ?? {});
                const data = await distributionService.updateDraft(organizationId, params.id, body);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update draft',
                });
            }
        }
    );

    fastify.post(
        '/:id/publish',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = draftParamsSchema.parse(request.params ?? {});
                const body = publishBodySchema.parse(request.body ?? {});
                const data = await distributionService.publishDraft(organizationId, params.id, body);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to publish draft',
                });
            }
        }
    );

    fastify.post(
        '/:id/track',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const params = draftParamsSchema.parse(request.params ?? {});
                const body = trackBodySchema.parse(request.body ?? {});
                const data = await distributionService.trackDraft(organizationId, params.id, body);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to track draft',
                });
            }
        }
    );
}

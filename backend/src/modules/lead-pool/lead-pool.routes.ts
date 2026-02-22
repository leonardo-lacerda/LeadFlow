import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { leadPoolService } from './lead-pool.service.js';

const searchQuerySchema = z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    category: z.string().optional(),
    source: z.string().optional(),
    freshnessDays: z.coerce.number().int().positive().max(365).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

const claimBodySchema = z.object({
    sharedLeadId: z.string().min(1),
    leadId: z.string().min(1).optional(),
    scrapingJobId: z.string().min(1).optional(),
});

async function getOrganizationId(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ organizationId: string }>();
    return decoded.organizationId;
}

export async function leadPoolRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/search',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = searchQuerySchema.parse(request.query ?? {});
                const data = await leadPoolService.search(organizationId, query);
                return reply.send({ success: true, data: data.items, meta: data.meta });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to search lead pool',
                });
            }
        }
    );

    fastify.post(
        '/claim',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const body = claimBodySchema.parse(request.body ?? {});
                const data = await leadPoolService.claim(organizationId, body);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to claim lead',
                });
            }
        }
    );

    fastify.get(
        '/stats',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const data = await leadPoolService.stats(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(500).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load lead pool stats',
                });
            }
        }
    );
}

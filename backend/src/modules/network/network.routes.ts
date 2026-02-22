import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { networkService } from './network.service.js';

const signalsQuerySchema = z.object({
    windowDays: z.coerce.number().int().min(7).max(180).default(30),
});

async function getOrganizationId(request: FastifyRequest) {
    const decoded = await request.jwtVerify<{ organizationId: string }>();
    return decoded.organizationId;
}

export async function networkRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/signals',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const organizationId = await getOrganizationId(request);
                const query = signalsQuerySchema.parse(request.query ?? {});
                const data = await networkService.getSignals(organizationId, query);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load network signals',
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
                const data = await networkService.getStats(organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                return reply.code(500).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to load network stats',
                });
            }
        }
    );
}

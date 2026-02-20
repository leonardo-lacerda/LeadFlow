import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { scoringService } from './scoring.service.js';
import { LEAD_TEMPERATURE_VALUES } from './scoring.types.js';

const leaderboardQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(50).default(8),
    temperature: z.enum(LEAD_TEMPERATURE_VALUES).optional(),
});

const recalculateSchema = z.object({
    leadIds: z.array(z.string().min(1)).min(1).optional(),
    limit: z.coerce.number().int().positive().max(1000).default(200),
});

export async function scoringRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/leaderboard',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const query = leaderboardQuerySchema.parse(request.query);
                const leads = await scoringService.getLeaderboard(decoded.organizationId, query);

                return reply.send({
                    success: true,
                    data: leads,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch scoring leaderboard',
                });
            }
        }
    );

    fastify.post(
        '/recalculate',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const body = recalculateSchema.parse(request.body ?? {});

                const job = await scoringService.enqueueRecalculation(decoded.organizationId, body);

                return reply.code(202).send({
                    success: true,
                    data: job,
                });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to enqueue score recalculation',
                });
            }
        }
    );
}

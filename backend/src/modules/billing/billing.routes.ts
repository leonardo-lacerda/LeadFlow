import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Plan } from '@prisma/client';
import { z } from 'zod';
import { assertAdminOrOwner } from '../../lib/rbac.js';
import { isLimitExceededError } from './billing.errors.js';
import { billingService } from './billing.service.js';

const purchaseOverageSchema = z.object({
    packs: z.coerce.number().int().positive().max(100).default(1),
    notes: z.string().max(500).optional(),
});

const changePlanSchema = z.object({
    plan: z.nativeEnum(Plan),
    reason: z.string().max(500).optional(),
});

function sendFailure(reply: FastifyReply, error: unknown, fallback: string) {
    if (isLimitExceededError(error)) {
        return reply.code(error.statusCode).send({
            success: false,
            code: error.code,
            error: error.message,
            details: error.details,
        });
    }

    return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : fallback,
    });
}

export async function billingRoutes(fastify: FastifyInstance) {
    fastify.get(
        '/catalog',
        { onRequest: [fastify.authenticate] },
        async (_request: FastifyRequest, reply: FastifyReply) => {
            try {
                const catalog = await billingService.getCatalog();
                return reply.send({ success: true, data: catalog });
            } catch (error) {
                return sendFailure(reply, error, 'Failed to load billing catalog');
            }
        }
    );

    fastify.get(
        '/usage',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const usage = await billingService.getUsageSnapshot(decoded.organizationId);
                return reply.send({ success: true, data: usage });
            } catch (error) {
                return sendFailure(reply, error, 'Failed to load billing usage');
            }
        }
    );

    fastify.get(
        '/overage',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ organizationId: string }>();
                const data = await billingService.listOveragePurchases(decoded.organizationId);
                return reply.send({ success: true, data });
            } catch (error) {
                return sendFailure(reply, error, 'Failed to load overage data');
            }
        }
    );

    fastify.post(
        '/overage/purchase',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
                await assertAdminOrOwner(decoded.userId, decoded.organizationId);
                const body = purchaseOverageSchema.parse(request.body);
                const purchase = await billingService.purchaseSignalsOverage(
                    decoded.organizationId,
                    decoded.userId,
                    body.packs,
                    body.notes
                );
                return reply.code(201).send({ success: true, data: purchase });
            } catch (error) {
                return sendFailure(reply, error, 'Failed to purchase overage');
            }
        }
    );

    fastify.post(
        '/change-plan',
        { onRequest: [fastify.authenticate] },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
                await assertAdminOrOwner(decoded.userId, decoded.organizationId);
                const body = changePlanSchema.parse(request.body);
                const usage = await billingService.changePlan(
                    decoded.organizationId,
                    decoded.userId,
                    body.plan,
                    body.reason
                );
                return reply.send({ success: true, data: usage });
            } catch (error) {
                return sendFailure(reply, error, 'Failed to change plan');
            }
        }
    );
}


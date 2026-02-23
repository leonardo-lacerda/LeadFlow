import { FastifyReply } from 'fastify';
import { isLimitExceededError } from './billing.errors.js';

export function sendLimitAwareError(
    reply: FastifyReply,
    error: unknown,
    fallback: string,
    defaultStatus = 400
) {
    if (isLimitExceededError(error)) {
        return reply.code(error.statusCode).send({
            success: false,
            code: error.code,
            error: error.message,
            details: error.details,
        });
    }

    return reply.code(defaultStatus).send({
        success: false,
        error: error instanceof Error ? error.message : fallback,
    });
}


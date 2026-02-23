import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { isTokenJtiRevoked } from '../lib/session-revocation.js';

const AUTH_COOKIE_NAME = 'lastreia_auth';

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

function extractBearerToken(request: FastifyRequest) {
    const header = request.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        return header.slice(7).trim();
    }

    const cookies = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies;
    const cookieToken = cookies?.[AUTH_COOKIE_NAME];
    return cookieToken || '';
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
        const token = extractBearerToken(request);
        if (!token) {
            throw new Error('Missing auth token');
        }

        if (!request.headers.authorization) {
            (request.headers as Record<string, string>).authorization = `Bearer ${token}`;
        }

        const decoded = await request.jwtVerify<{ userId?: string; organizationId?: string; jti?: string }>();

        if (!decoded.userId || !decoded.organizationId) {
            throw new Error('Invalid token payload');
        }

        if (await isTokenJtiRevoked(decoded.jti)) {
            throw new Error('Token revoked');
        }

        const member = await prisma.user.findFirst({
            where: {
                id: decoded.userId,
                organizationId: decoded.organizationId,
            },
            select: { id: true },
        });

        if (!member) {
            throw new Error('User not found in organization');
        }
    } catch (err) {
        reply.code(401).send({ success: false, error: 'Unauthorized' });
    }
}

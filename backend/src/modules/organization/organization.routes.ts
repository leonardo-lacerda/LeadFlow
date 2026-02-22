import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { organizationService } from './organization.service.js';

const updateOrgSchema = z.object({
    name: z.string().min(2).optional(),
    icpDefinition: z.record(z.any()).optional(),
    apiKeys: z.record(z.string()).optional(),
    webhooks: z.record(z.string().url()).optional(),
    onboardingCompleted: z.boolean().optional(),
    notificationSettings: z.record(z.any()).optional(),
    networkOptIn: z.boolean().optional(),
});

const inviteUserSchema = z.object({
    email: z.string().email(),
    role: z.enum(['ADMIN', 'MEMBER']),
});

async function requireAdminOrOwner(userId: string, organizationId: string) {
    const member = await prisma.user.findFirst({
        where: {
            id: userId,
            organizationId,
        },
        select: {
            role: true,
        },
    });

    if (!member) {
        throw new Error('User not found in organization');
    }

    if (member.role !== UserRole.OWNER && member.role !== UserRole.ADMIN) {
        throw new Error('Only ADMIN or OWNER can perform this action');
    }
}

export async function organizationRoutes(fastify: FastifyInstance) {
    // Get Organization Profile
    fastify.get(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
                const org = await organizationService.getOrganization(decoded.organizationId, decoded.userId);

                if (!org) {
                    return reply.code(404).send({ success: false, error: 'Organization not found' });
                }

                return reply.send({ success: true, data: org });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch organization',
                });
            }
        }
    );

    // Update Organization
    fastify.patch(
        '/',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
                await requireAdminOrOwner(decoded.userId, decoded.organizationId);
                const body = updateOrgSchema.parse(request.body);

                await organizationService.updateOrganization(decoded.organizationId, body);
                const org = await organizationService.getOrganization(decoded.organizationId, decoded.userId);
                if (!org) {
                    return reply.code(404).send({ success: false, error: 'Organization not found' });
                }

                return reply.send({ success: true, data: org });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to update organization',
                });
            }
        }
    );

    // Invite User
    fastify.post(
        '/users',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
                const body = inviteUserSchema.parse(request.body);

                await requireAdminOrOwner(decoded.userId, decoded.organizationId);

                const invite = await organizationService.inviteUser(
                    decoded.organizationId,
                    decoded.userId,
                    body
                );

                return reply.code(201).send({ success: true, data: invite });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to invite user',
                });
            }
        }
    );

    // Remove User
    fastify.delete<{ Params: { id: string } }>(
        '/users/:id',
        {
            onRequest: [fastify.authenticate],
        },
        async (request, reply) => {
            try {
                const decoded = await request.jwtVerify<{ userId: string; organizationId: string }>();
                const userId = request.params.id;

                await requireAdminOrOwner(decoded.userId, decoded.organizationId);

                await organizationService.removeUser(decoded.organizationId, userId, decoded.userId);

                return reply.send({ success: true, message: 'User removed' });
            } catch (error) {
                return reply.code(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to remove user',
                });
            }
        }
    );
}

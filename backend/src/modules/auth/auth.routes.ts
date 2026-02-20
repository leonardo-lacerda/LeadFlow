import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { z } from 'zod';

const registerSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    password: z.string().min(8),
    organizationName: z.string().min(2),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
});

const acceptInviteSchema = z.object({
    token: z.string().min(1),
    name: z.string().min(2),
    password: z.string().min(8),
});

export async function authRoutes(fastify: FastifyInstance) {
    // Register
    fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = registerSchema.parse(request.body);
            const result = await authService.register(body);

            // Create JWT token
            const token = fastify.jwt.sign({
                userId: result.user.id,
                organizationId: result.organization.id,
            });

            return reply.code(201).send({
                success: true,
                data: {
                    user: result.user,
                    organization: result.organization,
                    token,
                },
            });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Registration failed',
            });
        }
    });

    // Login
    fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = loginSchema.parse(request.body);
            const user = await authService.login(body);

            // Create JWT token
            const token = fastify.jwt.sign({
                userId: user.id,
                organizationId: user.organizationId,
            });

            return reply.send({
                success: true,
                data: {
                    user,
                    token,
                },
            });
        } catch (error) {
            return reply.code(401).send({
                success: false,
                error: error instanceof Error ? error.message : 'Login failed',
            });
        }
    });

    // Get current user
    fastify.get(
        '/me',
        {
            onRequest: [fastify.authenticate],
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const decoded = await request.jwtVerify<{ userId: string }>();
                const user = await authService.getMe(decoded.userId);

                return reply.send({
                    success: true,
                    data: user,
                });
            } catch (error) {
                return reply.code(401).send({
                    success: false,
                    error: 'Unauthorized',
                });
            }
        }
    );

    fastify.post('/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = forgotPasswordSchema.parse(request.body);
            const result = await authService.forgotPassword(body.email);
            return reply.send({
                success: true,
                data: result,
            });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Forgot password failed',
            });
        }
    });

    fastify.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = resetPasswordSchema.parse(request.body);
            await authService.resetPassword(body.token, body.password);
            return reply.send({
                success: true,
                message: 'Password updated successfully',
            });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Reset password failed',
            });
        }
    });

    fastify.post('/accept-invite', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = acceptInviteSchema.parse(request.body);
            const user = await authService.acceptInvite(body);
            const token = fastify.jwt.sign({
                userId: user.id,
                organizationId: user.organizationId,
            });

            return reply.send({
                success: true,
                data: {
                    user,
                    token,
                },
            });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Accept invite failed',
            });
        }
    });
}

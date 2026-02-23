import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { z } from 'zod';
import { env } from '../../config/env.js';
import {
    assertLoginAttemptAllowed,
    clearLoginFailures,
    recordLoginFailure,
} from '../../lib/auth-bruteforce.js';
import { generateTokenJti, revokeTokenJti } from '../../lib/session-revocation.js';
import { sendLimitAwareError } from '../billing/http.js';

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

const AUTH_COOKIE_NAME = 'lastreia_auth';

function getCookieOptions() {
    return {
        path: '/',
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7,
    };
}

function setAuthCookie(reply: FastifyReply, token: string) {
    reply.setCookie(AUTH_COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(reply: FastifyReply) {
    reply.clearCookie(AUTH_COOKIE_NAME, {
        ...getCookieOptions(),
        maxAge: 0,
    });
}

function extractAuthToken(request: FastifyRequest) {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    const cookies = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies;
    return cookies?.[AUTH_COOKIE_NAME] || '';
}

export async function authRoutes(fastify: FastifyInstance) {
    // Register
    fastify.post(
        '/register',
        {
            config: {
                rateLimit: {
                    max: 10,
                    timeWindow: '10 minutes',
                },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const body = registerSchema.parse(request.body);
                const result = await authService.register(body);

                // Create JWT token
                const token = fastify.jwt.sign({
                    userId: result.user.id,
                    organizationId: result.organization.id,
                    jti: generateTokenJti(),
                });
                setAuthCookie(reply, token);

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
        }
    );

    // Login
    fastify.post(
        '/login',
        {
            config: {
                rateLimit: {
                    max: 30,
                    timeWindow: '10 minutes',
                },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            const requestIp = request.ip;
            let parsedEmail: string | null = null;

            try {
                const body = loginSchema.parse(request.body);
                parsedEmail = body.email;
                await assertLoginAttemptAllowed({ email: body.email, ip: requestIp });
                const user = await authService.login(body);

                // Create JWT token
                const token = fastify.jwt.sign({
                    userId: user.id,
                    organizationId: user.organizationId,
                    jti: generateTokenJti(),
                });

                await clearLoginFailures({ email: body.email, ip: requestIp });
                setAuthCookie(reply, token);

                return reply.send({
                    success: true,
                    data: {
                        user,
                        token,
                    },
                });
            } catch (error) {
                if (parsedEmail) {
                    await recordLoginFailure({ email: parsedEmail, ip: requestIp }).catch(() => undefined);
                }
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        success: false,
                        error: error.message,
                    });
                }
                return reply.code(401).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Login failed',
                });
            }
        }
    );

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

    fastify.post(
        '/forgot-password',
        {
            config: {
                rateLimit: {
                    max: 8,
                    timeWindow: '10 minutes',
                },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
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
        }
    );

    fastify.post(
        '/reset-password',
        {
            config: {
                rateLimit: {
                    max: 8,
                    timeWindow: '10 minutes',
                },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
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
        }
    );

    fastify.post(
        '/accept-invite',
        {
            config: {
                rateLimit: {
                    max: 10,
                    timeWindow: '10 minutes',
                },
            },
        },
        async (request: FastifyRequest, reply: FastifyReply) => {
            try {
                const body = acceptInviteSchema.parse(request.body);
                const user = await authService.acceptInvite(body);
                const token = fastify.jwt.sign({
                    userId: user.id,
                    organizationId: user.organizationId,
                    jti: generateTokenJti(),
                });
                setAuthCookie(reply, token);

                return reply.send({
                    success: true,
                    data: {
                        user,
                        token,
                    },
                });
            } catch (error) {
                return sendLimitAwareError(reply, error, 'Accept invite failed');
            }
        }
    );

    fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
        const token = extractAuthToken(request);
        if (token) {
            try {
                const decoded = fastify.jwt.verify<{ jti?: string; exp?: number }>(token);
                await revokeTokenJti(decoded.jti || '', decoded.exp);
            } catch {
                // Ignore token parsing errors and still clear cookie.
            }
        }
        clearAuthCookie(reply);
        return reply.send({ success: true });
    });
}

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

interface RegisterBody {
    email: string;
    name: string;
    password: string;
    organizationName: string;
}

interface LoginBody {
    email: string;
    password: string;
}

const AUTH_ORG_SELECT = {
    id: true,
    name: true,
    slug: true,
    plan: true,
    leadsLimit: true,
    emailsLimit: true,
    whatsappLimit: true,
    enrichmentsLimit: true,
    leadsUsed: true,
    emailsUsed: true,
    whatsappUsed: true,
    enrichmentsUsed: true,
    onboardingCompleted: true,
} satisfies Prisma.OrganizationSelect;

const AUTH_USER_SELECT = {
    id: true,
    email: true,
    name: true,
    role: true,
    organizationId: true,
    createdAt: true,
    organization: {
        select: AUTH_ORG_SELECT,
    },
} satisfies Prisma.UserSelect;

function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
    async register(data: RegisterBody) {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new Error('User already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Create organization + user in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create organization
            const organization = await tx.organization.create({
                data: {
                    name: data.organizationName,
                    slug: data.organizationName.toLowerCase().replace(/\s+/g, '-'),
                },
                select: AUTH_ORG_SELECT,
            });

            // Create user (owner)
            const user = await tx.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                    passwordHash,
                    role: 'OWNER',
                    organizationId: organization.id,
                },
                select: AUTH_USER_SELECT,
            });

            return { user, organization };
        });

        return result;
    }

    async login(data: LoginBody) {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email: data.email },
            select: {
                ...AUTH_USER_SELECT,
                passwordHash: true,
            },
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const isValid = await bcrypt.compare(data.password, user.passwordHash);

        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const userWithoutPassword = { ...user };
        delete (userWithoutPassword as { passwordHash?: string }).passwordHash;
        return userWithoutPassword;
    }

    async getMe(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: AUTH_USER_SELECT,
        });

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    async forgotPassword(email: string) {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });

        if (!user) {
            return {
                success: true,
            };
        }

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1h

        await prisma.$transaction([
            prisma.passwordResetToken.updateMany({
                where: { userId: user.id, usedAt: null },
                data: { usedAt: new Date() },
            }),
            prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                },
            }),
        ]);

        return {
            success: true,
            resetUrl:
                env.NODE_ENV === 'development'
                    ? `${env.FRONTEND_URL}/reset-password?token=${token}`
                    : undefined,
        };
    }

    async resetPassword(token: string, password: string) {
        const tokenHash = hashToken(token);
        const now = new Date();
        const resetToken = await prisma.passwordResetToken.findFirst({
            where: {
                tokenHash,
                usedAt: null,
                expiresAt: { gt: now },
            },
            select: {
                id: true,
                userId: true,
            },
        });

        if (!resetToken) {
            throw new Error('Invalid or expired token');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash },
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: now },
            }),
        ]);

        return { success: true };
    }

    async acceptInvite(data: { token: string; name: string; password: string }) {
        const now = new Date();
        const tokenHash = hashToken(data.token);
        const invite = await prisma.organizationInvite.findFirst({
            where: {
                tokenHash,
                acceptedAt: null,
                expiresAt: { gt: now },
            },
            select: {
                id: true,
                email: true,
                role: true,
                organizationId: true,
            },
        });

        if (!invite) {
            throw new Error('Invalid or expired invite token');
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: invite.email },
            select: { id: true },
        });

        if (existingUser) {
            throw new Error('User already exists');
        }

        const passwordHash = await bcrypt.hash(data.password, 10);
        const user = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    email: invite.email,
                    name: data.name,
                    passwordHash,
                    role: invite.role,
                    organizationId: invite.organizationId,
                },
                select: AUTH_USER_SELECT,
            });

            await tx.organizationInvite.update({
                where: { id: invite.id },
                data: { acceptedAt: now },
            });

            return createdUser;
        });

        return user;
    }
}

export const authService = new AuthService();

import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { decryptStringMap, encryptStringMap } from '../../lib/secrets.js';

interface UpdateOrganizationInput {
    name?: string;
    icpDefinition?: unknown;
    apiKeys?: Record<string, string>;
    webhooks?: Record<string, string>;
    onboardingCompleted?: boolean;
    notificationSettings?: Record<string, unknown>;
    networkOptIn?: boolean;
}

interface InviteUserInput {
    email: string;
    role: 'ADMIN' | 'MEMBER';
}

interface InviteUserResult {
    email: string;
    role: 'ADMIN' | 'MEMBER';
    expiresAt: Date;
    inviteUrl: string;
}

const ORG_BASE_SELECT = {
    id: true,
    name: true,
    slug: true,
    plan: true,
    onboardingCompleted: true,
    networkOptIn: true,
    leadsLimit: true,
    emailsLimit: true,
    whatsappLimit: true,
    enrichmentsLimit: true,
    leadsUsed: true,
    emailsUsed: true,
    whatsappUsed: true,
    enrichmentsUsed: true,
    icpDefinition: true,
    apiKeys: true,
    webhooks: true,
    notificationSettings: true,
    users: {
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
        },
    },
    _count: {
        select: {
            leads: true,
            campaigns: true,
        },
    },
} satisfies Prisma.OrganizationSelect;

export class OrganizationService {
    async getOrganization(organizationId: string, userId: string) {
        const [member, org] = await Promise.all([
            prisma.user.findFirst({
                where: { id: userId, organizationId },
                select: { role: true },
            }),
            prisma.organization.findUnique({
                where: { id: organizationId },
                select: ORG_BASE_SELECT,
            }),
        ]);

        if (!member || !org) {
            return null;
        }

        const isPrivileged = member.role === 'OWNER' || member.role === 'ADMIN';
        const organizationData = {
            ...org,
            apiKeys: isPrivileged
                ? decryptStringMap((org.apiKeys || undefined) as Record<string, string> | undefined) || {}
                : undefined,
            webhooks: isPrivileged ? org.webhooks : undefined,
            notificationSettings: isPrivileged ? org.notificationSettings : undefined,
        };

        return organizationData;
    }

    async updateOrganization(id: string, data: UpdateOrganizationInput) {
        const current = await prisma.organization.findUnique({
            where: { id },
            select: {
                apiKeys: true,
                webhooks: true,
            },
        });

        if (!current) {
            throw new Error('Organization not found');
        }

        const currentApiKeys =
            decryptStringMap(
                ((current.apiKeys as Record<string, string> | null | undefined) || undefined) as
                | Record<string, string>
                | undefined
            ) || {};

        const mergedApiKeys =
            data.apiKeys !== undefined
                ? Object.fromEntries(
                    Object.entries({ ...currentApiKeys, ...data.apiKeys }).filter(
                        ([, value]) => Boolean(value && value.trim().length > 0)
                    )
                )
                : undefined;

        const encryptedApiKeys =
            mergedApiKeys !== undefined ? encryptStringMap(mergedApiKeys) || {} : undefined;

        const currentWebhooks =
            current.webhooks && typeof current.webhooks === 'object' && !Array.isArray(current.webhooks)
                ? (current.webhooks as Record<string, string>)
                : {};

        const mergedWebhooks =
            data.webhooks !== undefined
                ? Object.fromEntries(
                    Object.entries({ ...currentWebhooks, ...data.webhooks }).filter(
                        ([, value]) => Boolean(value && value.trim().length > 0)
                    )
                )
                : undefined;

        return prisma.organization.update({
            where: { id },
            data: {
                name: data.name,
                icpDefinition: data.icpDefinition as Prisma.InputJsonValue | undefined,
                apiKeys:
                    encryptedApiKeys !== undefined
                        ? (Object.keys(encryptedApiKeys).length > 0
                            ? (encryptedApiKeys as Prisma.InputJsonValue)
                            : Prisma.JsonNull)
                        : undefined,
                webhooks:
                    mergedWebhooks !== undefined
                        ? (Object.keys(mergedWebhooks).length > 0
                            ? (mergedWebhooks as Prisma.InputJsonValue)
                            : Prisma.JsonNull)
                        : undefined,
                onboardingCompleted: data.onboardingCompleted,
                notificationSettings: data.notificationSettings as Prisma.InputJsonValue | undefined,
                networkOptIn: data.networkOptIn,
            },
            select: ORG_BASE_SELECT,
        });
    }

    async inviteUser(
        organizationId: string,
        createdByUserId: string,
        data: InviteUserInput
    ): Promise<InviteUserResult> {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new Error('User already exists');
        }

        const inviteToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 72); // 72h

        await prisma.organizationInvite.updateMany({
            where: {
                organizationId,
                email: data.email,
                acceptedAt: null,
            },
            data: {
                acceptedAt: new Date(),
            },
        });

        await prisma.organizationInvite.create({
            data: {
                organizationId,
                createdByUserId,
                email: data.email,
                role: data.role,
                tokenHash,
                expiresAt,
            },
        });

        return {
            email: data.email,
            role: data.role,
            expiresAt,
            inviteUrl: `${env.FRONTEND_URL}/accept-invite?token=${inviteToken}`,
        };
    }

    async removeUser(organizationId: string, userId: string, requesterUserId: string) {
        const requester = await prisma.user.findFirst({
            where: { id: requesterUserId, organizationId },
            select: { role: true },
        });

        if (!requester) {
            throw new Error('Requester not found');
        }

        if (requester.role !== 'OWNER' && requester.role !== 'ADMIN') {
            throw new Error('Only ADMIN or OWNER can remove users');
        }

        if (userId === requesterUserId) {
            throw new Error('You cannot remove your own account');
        }

        // Ensure user belongs to organization
        const user = await prisma.user.findFirst({
            where: { id: userId, organizationId },
            select: {
                id: true,
                role: true,
            },
        });

        if (!user) {
            throw new Error('User not found in organization');
        }

        if (user.role === 'OWNER' && requester.role !== 'OWNER') {
            throw new Error('Only OWNER can remove another OWNER');
        }

        if (user.role === 'OWNER') {
            const ownersCount = await prisma.user.count({
                where: { organizationId, role: 'OWNER' },
            });
            if (ownersCount <= 1) {
                throw new Error('Cannot remove the last OWNER from organization');
            }
        }

        return prisma.user.delete({
            where: { id: userId },
        });
    }
}

export const organizationService = new OrganizationService();

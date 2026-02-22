import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { decryptStringMap, encryptStringMap } from '../../lib/secrets.js';

export type IntegrationApiKeys = Record<string, string>;

function mapFromJsonValue(value: Prisma.JsonValue | null | undefined): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => typeof entry === 'string')
        .map(([key, entry]) => [key, String(entry)]);

    return Object.fromEntries(entries);
}

function asInputJson(value: Record<string, string>) {
    if (Object.keys(value).length === 0) {
        return Prisma.JsonNull;
    }
    return value as unknown as Prisma.InputJsonValue;
}

export class IntegrationCredentialsService {
    async getApiKeys(organizationId: string): Promise<IntegrationApiKeys> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { apiKeys: true },
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        return decryptStringMap(mapFromJsonValue(org.apiKeys as Prisma.JsonValue | null)) || {};
    }

    async patchApiKeys(
        organizationId: string,
        patch: Record<string, string | null | undefined>
    ): Promise<IntegrationApiKeys> {
        const current = await this.getApiKeys(organizationId);
        const next: IntegrationApiKeys = { ...current };

        for (const [key, value] of Object.entries(patch)) {
            if (!value || value.trim().length === 0) {
                delete next[key];
            } else {
                next[key] = value.trim();
            }
        }

        const encrypted = encryptStringMap(next) || {};
        await prisma.organization.update({
            where: { id: organizationId },
            data: {
                apiKeys: asInputJson(encrypted),
            },
        });

        return next;
    }

    async clearProviderKeys(organizationId: string, provider: 'twitter' | 'linkedin') {
        if (provider === 'twitter') {
            return this.patchApiKeys(organizationId, {
                twitterAccessToken: null,
                twitterRefreshToken: null,
                twitterTokenExpiresAt: null,
                twitterTokenScope: null,
            });
        }

        return this.patchApiKeys(organizationId, {
            linkedinAccessToken: null,
            linkedinRefreshToken: null,
            linkedinTokenExpiresAt: null,
            linkedinAuthorUrn: null,
            linkedinTokenScope: null,
        });
    }
}

export const integrationCredentialsService = new IntegrationCredentialsService();

import { Prisma, SharedLead } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { normalizeCategory } from './category-normalizer.js';

export interface SharedLeadCandidate {
    googlePlaceId?: string | null;
    companyCnpj?: string | null;
    linkedinUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    companyName?: string | null;
    website?: string | null;
    city?: string | null;
    state?: string | null;
    category?: string | null;
    source: string;
    rawData?: Prisma.InputJsonValue;
    quality?: number;
}

function cleanString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : null;
}

function normalizeIdentifier(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
    const normalized = normalizeIdentifier(value);
    return normalized ? normalized.toLowerCase() : null;
}

function toQuality(value: number | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 50;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
}

async function findMatch(candidate: SharedLeadCandidate): Promise<SharedLead | null> {
    const keys: Prisma.SharedLeadWhereInput[] = [];

    const googlePlaceId = normalizeIdentifier(candidate.googlePlaceId);
    const companyCnpj = normalizeIdentifier(candidate.companyCnpj);
    const linkedinUrl = normalizeIdentifier(candidate.linkedinUrl);

    if (googlePlaceId) {
        keys.push({ googlePlaceId });
    }
    if (companyCnpj) {
        keys.push({ companyCnpj });
    }
    if (linkedinUrl) {
        keys.push({ linkedinUrl });
    }

    if (keys.length > 0) {
        const matched = await prisma.sharedLead.findFirst({
            where: {
                OR: keys,
            },
        });
        if (matched) {
            return matched;
        }
    }

    const email = normalizeEmail(candidate.email);
    const phone = normalizeIdentifier(candidate.phone);
    if (email || phone) {
        return prisma.sharedLead.findFirst({
            where: {
                AND: [
                    candidate.companyName
                        ? { companyName: { equals: candidate.companyName, mode: 'insensitive' } }
                        : {},
                    {
                        OR: [
                            ...(email ? [{ email }] : []),
                            ...(phone ? [{ phone }] : []),
                        ],
                    },
                ],
            },
        });
    }

    return null;
}

export class DedupService {
    async upsertSharedLead(candidate: SharedLeadCandidate): Promise<SharedLead> {
        const matched = await findMatch(candidate);
        const quality = toQuality(candidate.quality);

        const data: Prisma.SharedLeadUncheckedCreateInput = {
            googlePlaceId: normalizeIdentifier(candidate.googlePlaceId),
            companyCnpj: normalizeIdentifier(candidate.companyCnpj),
            linkedinUrl: normalizeIdentifier(candidate.linkedinUrl),
            email: normalizeEmail(candidate.email),
            phone: normalizeIdentifier(candidate.phone),
            fullName: cleanString(candidate.fullName),
            companyName: cleanString(candidate.companyName),
            website: cleanString(candidate.website),
            city: cleanString(candidate.city),
            state: cleanString(candidate.state),
            category: normalizeCategory(candidate.category),
            source: candidate.source,
            rawData: candidate.rawData,
            quality,
        };

        if (matched) {
            return prisma.sharedLead.update({
                where: { id: matched.id },
                data: {
                    googlePlaceId: data.googlePlaceId || undefined,
                    companyCnpj: data.companyCnpj || undefined,
                    linkedinUrl: data.linkedinUrl || undefined,
                    email: data.email || undefined,
                    phone: data.phone || undefined,
                    fullName: data.fullName || undefined,
                    companyName: data.companyName || undefined,
                    website: data.website || undefined,
                    city: data.city || undefined,
                    state: data.state || undefined,
                    category: data.category || undefined,
                    source: candidate.source,
                    rawData: candidate.rawData,
                    quality: {
                        set: Math.max(matched.quality, quality),
                    },
                    confirmations: {
                        increment: 1,
                    },
                    lastScrapedAt: new Date(),
                },
            });
        }

        return prisma.sharedLead.create({
            data,
        });
    }
}

export const dedupService = new DedupService();

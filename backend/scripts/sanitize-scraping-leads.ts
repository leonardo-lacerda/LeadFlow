import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

type JsonObject = Record<string, unknown>;

const SCRAPING_SOURCES = [
    'google_maps',
    'cnpj',
    'reclame_aqui',
    'indeed',
    'catho',
    'mercado_livre',
    'wappalyzer',
    'linkedin_dork',
    'comprasnet',
];

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const GENERIC_BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'google.com',
    'google.com.br',
    'googleusercontent.com',
    'duckduckgo.com',
    'bing.com',
    'search.brave.com',
];

const SOURCE_BLOCKED_DOMAINS: Record<string, string[]> = {
    google_maps: ['google.com', 'google.com.br', 'maps.google.com', 'maps.google.com.br'],
    indeed: ['indeed.com', 'indeed.com.br'],
    catho: ['catho.com.br'],
    reclame_aqui: ['reclameaqui.com.br'],
    mercado_livre: ['mercadolivre.com.br', 'mercadolibre.com'],
    comprasnet: ['comprasnet.gov.br', 'gov.br'],
    linkedin_dork: ['linkedin.com'],
    cnpj: ['cnpj.biz', 'receitaws.com.br'],
};

const DEFAULT_BATCH_SIZE = 200;
const MAX_SAMPLE_IDS = 20;

const prisma = new PrismaClient({
    log: ['error'],
});

function asCleanString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : undefined;
}

function normalizeUrl(value: unknown): string | null {
    const raw = asCleanString(value);
    if (!raw) {
        return null;
    }
    let candidate = raw;
    if (candidate.startsWith('//')) {
        candidate = `https:${candidate}`;
    } else if (!/^https?:\/\//i.test(candidate)) {
        candidate = `https://${candidate}`;
    }
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

function normalizeDomain(value: unknown): string | null {
    const fromUrl = normalizeUrl(value);
    if (fromUrl) {
        const host = new URL(fromUrl).hostname.toLowerCase();
        return host.startsWith('www.') ? host.slice(4) : host;
    }
    const raw = asCleanString(value)?.toLowerCase();
    if (!raw) {
        return null;
    }
    const withoutProtocol = raw.replace(/^https?:\/\//i, '');
    const host = withoutProtocol.split('/', 1)[0] ?? '';
    const cleanedHost = host.startsWith('www.') ? host.slice(4) : host;
    if (!cleanedHost || !cleanedHost.includes('.') || /\s/.test(cleanedHost)) {
        return null;
    }
    return cleanedHost;
}

function normalizeEmail(value: unknown): string | null {
    const raw = asCleanString(value)?.toLowerCase().replace(/[.,;:<>]+$/g, '');
    if (!raw) {
        return null;
    }
    return EMAIL_REGEX.test(raw) ? raw : null;
}

function normalizePhone(value: unknown): string | null {
    const raw = asCleanString(value);
    if (!raw) {
        return null;
    }
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 8) {
        return null;
    }
    return cleaned;
}

function normalizeTags(value: unknown, source: string | null): string[] {
    const items = Array.isArray(value) ? value : [];
    const result: string[] = [];
    const seen = new Set<string>();
    const pushTag = (raw: unknown) => {
        const cleaned = asCleanString(raw);
        if (!cleaned) {
            return;
        }
        const key = cleaned.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        result.push(cleaned);
    };
    if (source) {
        pushTag(source);
    }
    for (const item of items) {
        pushTag(item);
    }
    return result.slice(0, 30);
}

function toObject(value: unknown): JsonObject | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as JsonObject;
}

function normalizeStringArray(
    value: unknown,
    itemNormalizer: (raw: unknown) => string | null
): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    if (!Array.isArray(value)) {
        return result;
    }
    for (const item of value) {
        const normalized = itemNormalizer(item);
        if (!normalized) {
            continue;
        }
        const key = normalized.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(normalized);
        if (result.length >= 5) {
            break;
        }
    }
    return result;
}

function normalizeEnrichmentData(value: unknown): JsonObject | null {
    const root = toObject(value);
    if (!root) {
        return null;
    }
    const normalized: JsonObject = { ...root };

    if ('website' in root) {
        normalized.website = normalizeUrl(root.website);
    }

    const socials = toObject(root.socials);
    if (socials) {
        const normalizedSocials: Record<string, string> = {};
        for (const [key, raw] of Object.entries(socials)) {
            const url = normalizeUrl(raw);
            if (!url) {
                continue;
            }
            normalizedSocials[key] = url;
        }
        normalized.socials = normalizedSocials;
    }

    const contacts = toObject(root.contacts);
    if (contacts) {
        normalized.contacts = {
            ...contacts,
            emails: normalizeStringArray(contacts.emails, normalizeEmail),
            phones: normalizeStringArray(contacts.phones, normalizePhone),
        };
    }

    const maps = toObject(root.maps);
    if (maps) {
        normalized.maps = {
            ...maps,
            url: normalizeUrl(maps.url),
            rawUrl: normalizeUrl(maps.rawUrl),
            osmUrl: normalizeUrl(maps.osmUrl),
        };
    }

    return normalized;
}

function extractDomainFromEmail(value: string | null): string | null {
    if (!value) {
        return null;
    }
    const index = value.lastIndexOf('@');
    if (index === -1 || index === value.length - 1) {
        return null;
    }
    return normalizeDomain(value.slice(index + 1));
}

function isBlockedDomainForSource(domain: string, source: string | null): boolean {
    const sourceBlocklist = source ? SOURCE_BLOCKED_DOMAINS[source] || [] : [];
    const blocklist = [...GENERIC_BLOCKED_DOMAINS, ...sourceBlocklist];
    return blocklist.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

function getArgValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) {
        return null;
    }
    return process.argv[index + 1] ?? null;
}

type LeadRow = {
    id: string;
    source: string | null;
    sourceUrl: string | null;
    companyDomain: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    linkedinUrl: string | null;
    tags: string[];
    enrichmentData: Prisma.JsonValue | null;
};

async function sanitizeLead(lead: LeadRow, applyChanges: boolean) {
    const source = asCleanString(lead.source)?.toLowerCase() || null;

    const email = normalizeEmail(lead.email);
    const phone = normalizePhone(lead.phone);
    const whatsapp = normalizePhone(lead.whatsapp);
    const linkedinUrl = normalizeUrl(lead.linkedinUrl);
    const enrichmentData = normalizeEnrichmentData(lead.enrichmentData);

    const maps = enrichmentData ? toObject(enrichmentData.maps) : null;
    let sourceUrl = normalizeUrl(lead.sourceUrl);
    if (!sourceUrl && source === 'linkedin_dork' && linkedinUrl) {
        sourceUrl = linkedinUrl;
    }
    if (!sourceUrl && maps) {
        sourceUrl =
            normalizeUrl(maps.url) ||
            normalizeUrl(maps.rawUrl) ||
            normalizeUrl(maps.osmUrl);
    }

    const domainCandidates = [
        normalizeDomain(lead.companyDomain),
        extractDomainFromEmail(email),
        normalizeDomain(sourceUrl),
    ].filter((item): item is string => Boolean(item));
    const companyDomain =
        domainCandidates.find((candidate) => !isBlockedDomainForSource(candidate, source)) || null;

    const tags = normalizeTags(lead.tags, source);

    const originalEnrichmentJson = JSON.stringify(lead.enrichmentData ?? null);
    const nextEnrichmentJson = JSON.stringify(enrichmentData ?? null);

    const changed =
        (lead.email ?? null) !== (email ?? null) ||
        (lead.phone ?? null) !== (phone ?? null) ||
        (lead.whatsapp ?? null) !== (whatsapp ?? null) ||
        (lead.linkedinUrl ?? null) !== (linkedinUrl ?? null) ||
        (lead.sourceUrl ?? null) !== (sourceUrl ?? null) ||
        (lead.companyDomain ?? null) !== companyDomain ||
        JSON.stringify(lead.tags || []) !== JSON.stringify(tags) ||
        originalEnrichmentJson !== nextEnrichmentJson;

    if (!changed) {
        return { changed: false };
    }

    if (applyChanges) {
        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                email,
                phone,
                whatsapp,
                linkedinUrl,
                sourceUrl,
                companyDomain,
                tags,
                enrichmentData: enrichmentData as Prisma.InputJsonValue | null,
            },
        });
    }

    return { changed: true };
}

async function main() {
    const applyChanges = process.argv.includes('--apply');
    const sourceArg = getArgValue('--source');
    const organizationId = getArgValue('--organization');
    const batchSizeArg = getArgValue('--batch');
    const batchSize = Number(batchSizeArg || DEFAULT_BATCH_SIZE);

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new Error('--batch must be a positive integer');
    }
    if (sourceArg && !SCRAPING_SOURCES.includes(sourceArg)) {
        throw new Error(`--source must be one of: ${SCRAPING_SOURCES.join(', ')}`);
    }

    const sourceFilter = sourceArg ? [sourceArg] : SCRAPING_SOURCES;
    const where: Prisma.LeadWhereInput = {
        source: { in: sourceFilter },
        ...(organizationId ? { organizationId } : {}),
    };

    let cursor: string | undefined;
    let scanned = 0;
    let changed = 0;
    const sampleChangedIds: string[] = [];

    while (true) {
        const leads = await prisma.lead.findMany({
            where,
            take: batchSize,
            orderBy: { id: 'asc' },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                source: true,
                sourceUrl: true,
                companyDomain: true,
                email: true,
                phone: true,
                whatsapp: true,
                linkedinUrl: true,
                tags: true,
                enrichmentData: true,
            },
        });

        if (leads.length === 0) {
            break;
        }

        for (const lead of leads) {
            scanned += 1;
            const result = await sanitizeLead(lead, applyChanges);
            if (!result.changed) {
                continue;
            }

            changed += 1;
            if (sampleChangedIds.length < MAX_SAMPLE_IDS) {
                sampleChangedIds.push(lead.id);
            }
        }

        cursor = leads[leads.length - 1]?.id;
    }

    console.log(
        JSON.stringify(
            {
                mode: applyChanges ? 'apply' : 'dry-run',
                source: sourceArg || 'all_scraping_sources',
                organizationId: organizationId || null,
                scanned,
                changed,
                sampleChangedIds,
            },
            null,
            2
        )
    );
}

main()
    .catch((error) => {
        console.error(
            '[sanitize-scraping-leads] failed:',
            error instanceof Error ? error.message : error
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

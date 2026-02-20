import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

type JsonObject = Record<string, unknown>;

const GOOGLE_MAPS_ALLOWED_HOSTS = new Set([
    'google.com',
    'google.com.br',
    'maps.google.com',
    'maps.google.com.br',
]);

const GOOGLE_MAPS_BLOCKED_PATH_PREFIXES = [
    '/maps/dir',
    '/maps/directions',
    '/maps/embed',
    '/maps/about',
    '/maps/reserve',
    '/maps/timeline',
    '/maps/contrib',
];

const DEFAULT_BATCH_SIZE = 200;
const MAX_SAMPLE_IDS = 20;

const prisma = new PrismaClient({
    log: ['error'],
});

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUrl(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    let candidate = trimmed;
    if (candidate.startsWith('//')) {
        candidate = `https:${candidate}`;
    }
    if (!/^https?:\/\//i.test(candidate)) {
        candidate = `https://${candidate}`;
    }

    try {
        return new URL(candidate).toString();
    } catch {
        return null;
    }
}

function toHostname(url: string): string {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
}

function isGoogleMapsUrl(value: unknown): boolean {
    const normalized = normalizeUrl(value);
    if (!normalized) {
        return false;
    }

    let parsed: URL;
    try {
        parsed = new URL(normalized);
    } catch {
        return false;
    }

    const host = toHostname(normalized);
    if (!GOOGLE_MAPS_ALLOWED_HOSTS.has(host)) {
        return false;
    }

    const path = parsed.pathname.toLowerCase();
    if (GOOGLE_MAPS_BLOCKED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        return false;
    }

    if (host.startsWith('maps.google')) {
        return true;
    }

    if (!path.startsWith('/maps')) {
        return false;
    }

    if (path === '/maps' || path === '/maps/') {
        const query = parsed.search.toLowerCase();
        return ['cid=', 'q=', 'query=', 'll=', 'ftid='].some((token) => query.includes(token));
    }

    return true;
}

function isOpenStreetMapUrl(value: unknown): boolean {
    const normalized = normalizeUrl(value);
    if (!normalized) {
        return false;
    }

    try {
        const host = toHostname(normalized);
        return host === 'openstreetmap.org' || host.endsWith('.openstreetmap.org');
    } catch {
        return false;
    }
}

function isMapUrl(value: unknown): boolean {
    return isGoogleMapsUrl(value) || isOpenStreetMapUrl(value);
}

function firstValid(
    values: Array<string | null>,
    predicate: (value: string) => boolean
): string | null {
    for (const value of values) {
        if (!value) {
            continue;
        }
        if (predicate(value)) {
            return value;
        }
    }
    return null;
}

function getArgValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) {
        return null;
    }
    return process.argv[index + 1] ?? null;
}

type LeadToFix = {
    id: string;
    sourceUrl: string | null;
    enrichmentData: Prisma.JsonValue | null;
};

async function sanitizeLead(lead: LeadToFix, applyChanges: boolean) {
    const enrichmentData = isObject(lead.enrichmentData) ? { ...lead.enrichmentData } : {};
    const maps = isObject(enrichmentData.maps) ? { ...enrichmentData.maps } : {};

    const currentSourceUrl = normalizeUrl(lead.sourceUrl);
    const currentMapUrl = normalizeUrl(maps.url);
    const currentRawUrl = normalizeUrl(maps.rawUrl);
    const currentOsmUrl = normalizeUrl(maps.osmUrl);

    const normalizedGoogleMapUrl = firstValid(
        [currentMapUrl, currentRawUrl, currentSourceUrl],
        (url) => isGoogleMapsUrl(url)
    );

    const normalizedOsmUrl = firstValid([currentOsmUrl, currentRawUrl], (url) =>
        isOpenStreetMapUrl(url)
    );

    const normalizedRawUrl = firstValid(
        [currentRawUrl, currentSourceUrl, currentMapUrl],
        (url) => isMapUrl(url)
    );

    const normalizedMapUrl = normalizedGoogleMapUrl ?? normalizedOsmUrl;

    const nextSourceUrl = firstValid(
        [currentSourceUrl, normalizedMapUrl, normalizedRawUrl],
        (url) => isMapUrl(url)
    );

    const nextMaps = {
        url: normalizedMapUrl,
        rawUrl: normalizedRawUrl,
        osmUrl: normalizedOsmUrl,
    };

    const mapsShapeWasInvalid = !isObject(enrichmentData.maps);
    const mapsChanged =
        mapsShapeWasInvalid ||
        currentMapUrl !== nextMaps.url ||
        currentRawUrl !== nextMaps.rawUrl ||
        currentOsmUrl !== nextMaps.osmUrl;
    const sourceUrlChanged = currentSourceUrl !== nextSourceUrl;

    if (!mapsChanged && !sourceUrlChanged) {
        return {
            changed: false,
            sourceUrlChanged: false,
            mapsChanged: false,
        };
    }

    if (applyChanges) {
        const nextEnrichmentData: JsonObject = {
            ...enrichmentData,
            maps: nextMaps,
        };

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                sourceUrl: nextSourceUrl,
                enrichmentData: nextEnrichmentData as Prisma.InputJsonValue,
            },
        });
    }

    return {
        changed: true,
        sourceUrlChanged,
        mapsChanged,
    };
}

async function main() {
    const applyChanges = process.argv.includes('--apply');
    const organizationId = getArgValue('--organization');
    const batchSizeArg = getArgValue('--batch');
    const batchSize = Number(batchSizeArg || DEFAULT_BATCH_SIZE);

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new Error('--batch must be a positive integer');
    }

    const where: Prisma.LeadWhereInput = {
        source: 'google_maps',
        ...(organizationId ? { organizationId } : {}),
    };

    let cursor: string | undefined;
    let scanned = 0;
    let changed = 0;
    let mapsChangedCount = 0;
    let sourceUrlChangedCount = 0;
    const sampleChangedIds: string[] = [];

    while (true) {
        const leads = await prisma.lead.findMany({
            where,
            take: batchSize,
            orderBy: { id: 'asc' },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: {
                id: true,
                sourceUrl: true,
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
            if (result.mapsChanged) {
                mapsChangedCount += 1;
            }
            if (result.sourceUrlChanged) {
                sourceUrlChangedCount += 1;
            }
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
                organizationId: organizationId || null,
                scanned,
                changed,
                mapsChanged: mapsChangedCount,
                sourceUrlChanged: sourceUrlChangedCount,
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
            '[sanitize-google-maps-leads] failed:',
            error instanceof Error ? error.message : error
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

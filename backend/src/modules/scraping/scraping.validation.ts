import { ScrapingSource } from './scraping.service.js';

const DEFAULT_LIMIT = 100;
const MIN_LIMIT = 1;
const MAX_LIMIT = 1000;

function asObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Query must be an object');
    }
    return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown, fieldName: string) {
    if (typeof value !== 'string') {
        throw new Error(`${fieldName} is required`);
    }
    const cleaned = value.trim();
    if (!cleaned) {
        throw new Error(`${fieldName} is required`);
    }
    return cleaned;
}

function parseLimit(value: unknown) {
    if (value === undefined || value === null || value === '') {
        return DEFAULT_LIMIT;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error(`limit must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`);
    }
    if (parsed < MIN_LIMIT || parsed > MAX_LIMIT) {
        throw new Error(`limit must be between ${MIN_LIMIT} and ${MAX_LIMIT}`);
    }
    return parsed;
}

function parseListField(value: unknown, fieldName: string) {
    const rawItems = Array.isArray(value)
        ? value
              .flatMap((item) => (typeof item === 'string' ? item.split(/[\n,;]+/) : []))
              .map((item) => item.trim())
        : typeof value === 'string'
            ? value.split(/[\n,;]+/).map((item) => item.trim())
            : [];

    const deduped = Array.from(new Set(rawItems.filter(Boolean)));
    if (deduped.length === 0) {
        throw new Error(`${fieldName} is required`);
    }
    return deduped.length === 1 ? deduped[0] : deduped;
}

export function sanitizeScrapingQuery(
    source: ScrapingSource,
    input: unknown
): Record<string, unknown> {
    const query = asObject(input);
    const limit = parseLimit(query.limit);

    if (source === 'google_maps' || source === 'indeed' || source === 'catho') {
        return {
            query: asTrimmedString(query.query, 'query'),
            location: asTrimmedString(query.location, 'location'),
            limit,
        };
    }

    if (source === 'cnpj') {
        return {
            cnpj: parseListField(query.cnpj, 'cnpj'),
            limit,
        };
    }

    if (source === 'wappalyzer') {
        return {
            urls: parseListField(query.urls, 'urls'),
            limit,
        };
    }

    if (
        source === 'reclame_aqui' ||
        source === 'mercado_livre' ||
        source === 'linkedin_dork' ||
        source === 'comprasnet'
    ) {
        return {
            query: asTrimmedString(query.query, 'query'),
            limit,
        };
    }

    throw new Error('Unsupported scraping source');
}


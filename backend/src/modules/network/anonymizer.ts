function normalizeText(value: string | null | undefined, fallback = 'unknown'): string {
    if (!value) {
        return fallback;
    }

    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || fallback;
}

export function anonymizeSegment(segment: string | null | undefined): string {
    const normalized = normalizeText(segment);
    const parts = normalized.split('|').slice(0, 3);
    return parts.join('|');
}

export function shouldExposeBucket(sampleSize: number, minimum = 3): boolean {
    return sampleSize >= minimum;
}

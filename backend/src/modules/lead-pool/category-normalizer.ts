const CATEGORY_ALIASES: Record<string, string> = {
    odontologia: 'odontologia',
    dentista: 'odontologia',
    dentistas: 'odontologia',
    clinica_odontologica: 'odontologia',
    software: 'software',
    saas: 'software',
    tecnologia: 'software',
    consultoria: 'consultoria',
    marketing: 'marketing',
    advocacia: 'juridico',
    juridico: 'juridico',
    contabilidade: 'contabilidade',
    varejo: 'varejo',
    industria: 'industria',
    industrial: 'industria',
    saude: 'saude',
    clinica: 'saude',
};

function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function normalizeCategory(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }

    const slug = slugify(value);
    if (!slug) {
        return null;
    }

    return CATEGORY_ALIASES[slug] || slug;
}

export function normalizeLocationToken(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    const slug = slugify(value);
    return slug || null;
}

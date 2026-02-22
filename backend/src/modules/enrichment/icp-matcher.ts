function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function extractList(value: unknown): string[] {
    if (!value) {
        return [];
    }
    if (typeof value === 'string') {
        return value.trim() ? [value.trim()] : [];
    }
    if (Array.isArray(value)) {
        return value.flatMap((item) => extractList(item));
    }
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).flatMap((item) => extractList(item));
    }
    return [];
}

function matchAny(values: Array<string | null | undefined>, targets: string[]): boolean {
    const normalizedTargets = targets.map((target) => normalizeText(target));
    const normalizedValues = values
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeText(value));

    return normalizedValues.some((value) =>
        normalizedTargets.some((target) => value.includes(target) || target.includes(value))
    );
}

export interface IcpMatchInput {
    industry?: string | null;
    jobTitle?: string | null;
    seniority?: string | null;
    department?: string | null;
    companySize?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
}

export interface IcpMatchResult {
    icpMatch: number;
    reasons: string[];
}

export function matchLeadAgainstIcp(
    lead: IcpMatchInput,
    icpDefinition: Record<string, unknown> | null
): IcpMatchResult {
    if (!icpDefinition) {
        return {
            icpMatch: 0,
            reasons: [],
        };
    }

    const industryTargets = [
        ...extractList(icpDefinition['industry']),
        ...extractList(icpDefinition['industries']),
        ...extractList(icpDefinition['targetIndustries']),
    ];

    const roleTargets = [
        ...extractList(icpDefinition['jobTitle']),
        ...extractList(icpDefinition['jobTitles']),
        ...extractList(icpDefinition['roles']),
    ];

    const sizeTargets = [
        ...extractList(icpDefinition['companySize']),
        ...extractList(icpDefinition['companySizes']),
        ...extractList(icpDefinition['employeeRange']),
    ];

    const locationTargets = [
        ...extractList(icpDefinition['location']),
        ...extractList(icpDefinition['locations']),
        ...extractList(icpDefinition['countries']),
    ];

    let score = 0;
    const reasons: string[] = [];

    if (industryTargets.length > 0 && matchAny([lead.industry], industryTargets)) {
        score += 0.35;
        reasons.push('industry_match');
    }

    if (
        roleTargets.length > 0 &&
        matchAny([lead.jobTitle, lead.seniority, lead.department], roleTargets)
    ) {
        score += 0.3;
        reasons.push('role_match');
    }

    if (sizeTargets.length > 0 && matchAny([lead.companySize], sizeTargets)) {
        score += 0.2;
        reasons.push('size_match');
    }

    if (locationTargets.length > 0 && matchAny([lead.city, lead.state, lead.country], locationTargets)) {
        score += 0.15;
        reasons.push('location_match');
    }

    return {
        icpMatch: Number(Math.max(0, Math.min(1, score)).toFixed(4)),
        reasons,
    };
}

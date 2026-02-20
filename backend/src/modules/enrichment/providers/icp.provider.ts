export type MaturityLevel = 'EARLY_STAGE' | 'GROWING' | 'ESTABLISHED' | 'ENTERPRISE';

export interface IcpClassificationInput {
    industry?: string | null;
    jobTitle?: string | null;
    seniority?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    companySize?: string | null;
    companyEmployees?: string | null;
    companyRevenue?: string | null;
    technologies?: string[];
}

export interface IcpClassificationResult {
    icpMatch?: number;
    icpReasons: string[];
    maturityLevel?: MaturityLevel;
}

function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function toList(value: unknown): string[] {
    if (!value) {
        return [];
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }

    if (Array.isArray(value)) {
        return value.flatMap((entry) => toList(entry));
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return Object.values(record).flatMap((entry) => toList(entry));
    }

    return [];
}

function extractByPath(source: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
        if (current && typeof current === 'object') {
            return (current as Record<string, unknown>)[key];
        }
        return undefined;
    }, source);
}

function matchesAny(values: Array<string | null | undefined>, targets: string[]): boolean {
    if (targets.length === 0) {
        return false;
    }

    const normalizedValues = values
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeText(value));
    const normalizedTargets = targets.map((target) => normalizeText(target));

    return normalizedValues.some((value) =>
        normalizedTargets.some((target) => value.includes(target) || target.includes(value))
    );
}

function parseHumanNumber(value: string): number | null {
    const normalized = value
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(',', '.')
        .replace(/R\$/g, '');
    const match = normalized.match(/^(\d+(?:\.\d+)?)(K|M|B)?$/);
    if (!match) {
        return null;
    }

    const base = Number(match[1]);
    if (Number.isNaN(base)) {
        return null;
    }

    const multiplier = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : match[2] === 'B' ? 1_000_000_000 : 1;
    return base * multiplier;
}

function parseEmployeesMax(value: string | null | undefined): number | null {
    if (!value) {
        return null;
    }
    const cleaned = value.replace(/\s+/g, '');
    if (cleaned.includes('+')) {
        const start = Number(cleaned.replace('+', ''));
        return Number.isNaN(start) ? null : start;
    }
    const rangeMatch = cleaned.match(/(\d+)[^\d]+(\d+)/);
    if (rangeMatch) {
        return Number(rangeMatch[2]);
    }
    const numeric = Number(cleaned);
    return Number.isNaN(numeric) ? null : numeric;
}

function inferMaturity(input: IcpClassificationInput): MaturityLevel {
    const employeeMax = parseEmployeesMax(input.companyEmployees || input.companySize);

    if (employeeMax !== null) {
        if (employeeMax <= 10) {
            return 'EARLY_STAGE';
        }
        if (employeeMax <= 50) {
            return 'GROWING';
        }
        if (employeeMax <= 200) {
            return 'ESTABLISHED';
        }
        return 'ENTERPRISE';
    }

    const revenue = input.companyRevenue ? parseHumanNumber(input.companyRevenue) : null;
    if (revenue !== null) {
        if (revenue < 1_000_000) {
            return 'EARLY_STAGE';
        }
        if (revenue < 10_000_000) {
            return 'GROWING';
        }
        if (revenue < 100_000_000) {
            return 'ESTABLISHED';
        }
        return 'ENTERPRISE';
    }

    if ((input.technologies || []).length >= 8) {
        return 'ENTERPRISE';
    }
    if ((input.technologies || []).length >= 4) {
        return 'ESTABLISHED';
    }

    return 'GROWING';
}

interface CustomRule {
    field: string;
    operator: 'eq' | 'neq' | 'gte' | 'lte' | 'contains' | 'in';
    value: unknown;
}

function evaluateCustomRule(rule: CustomRule, input: IcpClassificationInput): boolean {
    const currentValue = (input as Record<string, unknown>)[rule.field];

    if (rule.operator === 'contains') {
        if (typeof currentValue === 'string' && typeof rule.value === 'string') {
            return normalizeText(currentValue).includes(normalizeText(rule.value));
        }
        if (Array.isArray(currentValue)) {
            const targets = toList(rule.value).map((entry) => normalizeText(entry));
            return currentValue.some(
                (entry) =>
                    typeof entry === 'string' &&
                    targets.some((target) => normalizeText(entry).includes(target))
            );
        }
        return false;
    }

    if (rule.operator === 'in') {
        const expected = toList(rule.value).map((entry) => normalizeText(entry));
        if (typeof currentValue === 'string') {
            const normalized = normalizeText(currentValue);
            return expected.some((entry) => normalized === entry);
        }
        return false;
    }

    if (rule.operator === 'eq' || rule.operator === 'neq') {
        const left = typeof currentValue === 'string' ? normalizeText(currentValue) : currentValue;
        const right = typeof rule.value === 'string' ? normalizeText(rule.value) : rule.value;
        return rule.operator === 'eq' ? left === right : left !== right;
    }

    if (rule.operator === 'gte' || rule.operator === 'lte') {
        const left =
            typeof currentValue === 'number'
                ? currentValue
                : typeof currentValue === 'string'
                ? parseHumanNumber(currentValue)
                : null;
        const right =
            typeof rule.value === 'number'
                ? rule.value
                : typeof rule.value === 'string'
                ? parseHumanNumber(rule.value)
                : null;

        if (left === null || right === null) {
            return false;
        }

        return rule.operator === 'gte' ? left >= right : left <= right;
    }

    return false;
}

export class IcpProvider {
    classify(
        input: IcpClassificationInput,
        icpDefinition: Record<string, unknown> | null
    ): IcpClassificationResult {
        const maturityLevel = inferMaturity(input);
        const definition = icpDefinition ?? {};

        const industries = toList(
            extractByPath(definition, 'industries') ?? extractByPath(definition, 'industry')
        );
        const companySizes = toList(
            extractByPath(definition, 'companySizes') ?? extractByPath(definition, 'companySize')
        );
        const seniorityLevels = toList(
            extractByPath(definition, 'seniorityLevels') ?? extractByPath(definition, 'roles')
        );
        const locations = toList(
            extractByPath(definition, 'locations') ?? extractByPath(definition, 'location')
        );
        const technologies = toList(
            extractByPath(definition, 'technologies') ?? extractByPath(definition, 'technology')
        );
        const customRulesRaw = extractByPath(definition, 'customRules');
        const customRules = Array.isArray(customRulesRaw)
            ? customRulesRaw.filter((entry): entry is CustomRule => {
                  if (!entry || typeof entry !== 'object') {
                      return false;
                  }
                  const record = entry as Record<string, unknown>;
                  return (
                      typeof record['field'] === 'string' &&
                      typeof record['operator'] === 'string'
                  );
              })
            : [];

        const reasons: string[] = [];
        let points = 0;
        let total = 0;

        if (industries.length > 0) {
            total += 1;
            if (matchesAny([input.industry], industries)) {
                points += 1;
                reasons.push('industry_match');
            }
        }

        if (companySizes.length > 0) {
            total += 1;
            if (matchesAny([input.companySize, input.companyEmployees], companySizes)) {
                points += 1;
                reasons.push('size_match');
            }
        }

        if (seniorityLevels.length > 0) {
            total += 1;
            if (matchesAny([input.jobTitle, input.seniority], seniorityLevels)) {
                points += 1;
                reasons.push('seniority_match');
            }
        }

        if (locations.length > 0) {
            total += 1;
            if (matchesAny([input.city, input.state, input.country], locations)) {
                points += 1;
                reasons.push('location_match');
            }
        }

        if (technologies.length > 0) {
            total += 1;
            if (matchesAny(input.technologies || [], technologies)) {
                points += 1;
                reasons.push('tech_fit');
            }
        }

        if (customRules.length > 0) {
            total += 1;
            const passedCustomRule = customRules.some((rule) => evaluateCustomRule(rule, input));
            if (passedCustomRule) {
                points += 1;
                reasons.push('custom_rule_match');
            }
        }

        const icpMatch = total > 0 ? Number((points / total).toFixed(2)) : undefined;

        return {
            icpMatch,
            icpReasons: reasons,
            maturityLevel,
        };
    }
}

export const icpProvider = new IcpProvider();

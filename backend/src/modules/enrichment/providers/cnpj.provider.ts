export interface CnpjEnrichmentInput {
    companyCnpj?: string | null;
}

export interface CnpjEnrichmentResult {
    companyName?: string;
    companyRevenue?: string;
    companyEmployees?: string;
    companySize?: string;
    industry?: string;
    metadata?: Record<string, unknown>;
}

function sanitizeCnpj(value: string) {
    return value.replace(/\D/g, '');
}

function mapPorteToEmployees(porte: string | undefined): string | undefined {
    if (!porte) {
        return undefined;
    }

    const normalized = porte.toLowerCase();
    if (normalized.includes('mei') || normalized.includes('micro')) {
        return '1-10';
    }
    if (normalized.includes('pequeno')) {
        return '11-50';
    }
    if (normalized.includes('medio') || normalized.includes('médio')) {
        return '51-200';
    }
    if (normalized.includes('grande')) {
        return '200+';
    }
    return undefined;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

export class CnpjProvider {
    async enrich(input: CnpjEnrichmentInput): Promise<CnpjEnrichmentResult> {
        if (!input.companyCnpj) {
            return {};
        }

        const cnpj = sanitizeCnpj(input.companyCnpj);
        if (cnpj.length !== 14) {
            return {};
        }

        try {
            const response = await fetchWithTimeout(
                `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
                6000
            );

            if (!response.ok) {
                return {};
            }

            const data = (await response.json()) as Record<string, unknown>;
            const companySize =
                (data['porte'] as string | undefined) ||
                (data['descricao_porte'] as string | undefined);
            const companyRevenue = data['capital_social']
                ? String(data['capital_social'])
                : undefined;
            const industry =
                (data['cnae_fiscal_descricao'] as string | undefined) ||
                (data['cnae_fiscal'] as string | undefined);

            return {
                companyName: data['razao_social'] as string | undefined,
                companyRevenue,
                companyEmployees: mapPorteToEmployees(companySize),
                companySize,
                industry,
                metadata: data,
            };
        } catch {
            return {};
        }
    }
}

export const cnpjProvider = new CnpjProvider();

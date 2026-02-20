export interface DomainEnrichmentInput {
    companyDomain?: string | null;
    email?: string | null;
    sourceUrl?: string | null;
}

export interface DomainEnrichmentResult {
    companyDomain?: string;
    technologies?: string[];
    metadata?: Record<string, unknown>;
}

const TECHNOLOGY_SIGNATURES: Array<{ name: string; patterns: RegExp[] }> = [
    { name: 'wordpress', patterns: [/wp-content/i, /wordpress/i] },
    { name: 'shopify', patterns: [/cdn\.shopify/i, /shopify/i] },
    { name: 'wix', patterns: [/wix\.com/i, /_wixCIDX/i] },
    { name: 'hubspot', patterns: [/hs-script-loader/i, /hubspot/i] },
    { name: 'salesforce', patterns: [/salesforce/i, /force\.com/i] },
    { name: 'google_analytics', patterns: [/google-analytics\.com/i, /gtag\(/i] },
    { name: 'google_tag_manager', patterns: [/googletagmanager\.com/i, /GTM-[A-Z0-9]+/i] },
    { name: 'react', patterns: [/react/i, /__REACT_DEVTOOLS_GLOBAL_HOOK__/i] },
    { name: 'nextjs', patterns: [/_next\/static/i, /__NEXT_DATA__/i] },
    { name: 'bootstrap', patterns: [/bootstrap/i] },
    { name: 'tailwind', patterns: [/tailwind/i] },
];

function normalizeDomain(domain: string) {
    const trimmed = domain.trim().toLowerCase();
    return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

function extractDomain(input: DomainEnrichmentInput): string | null {
    if (input.companyDomain) {
        return normalizeDomain(input.companyDomain);
    }

    if (input.email && input.email.includes('@')) {
        return normalizeDomain(input.email.split('@')[1] || '');
    }

    if (input.sourceUrl) {
        try {
            const parsed = new URL(input.sourceUrl);
            return normalizeDomain(parsed.hostname);
        } catch {
            return null;
        }
    }

    return null;
}

async function fetchWebsite(domain: string, protocol: 'https' | 'http') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
        const response = await fetch(`${protocol}://${domain}`, {
            signal: controller.signal,
            redirect: 'follow',
        });

        if (!response.ok) {
            return null;
        }

        const html = await response.text();
        return {
            html,
            headers: Object.fromEntries(response.headers.entries()),
            finalUrl: response.url,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function detectTechnologies(payload: string): string[] {
    const technologies = new Set<string>();

    for (const signature of TECHNOLOGY_SIGNATURES) {
        const matched = signature.patterns.some((pattern) => pattern.test(payload));
        if (matched) {
            technologies.add(signature.name);
        }
    }

    return Array.from(technologies);
}

export class DomainProvider {
    async enrich(input: DomainEnrichmentInput): Promise<DomainEnrichmentResult> {
        const domain = extractDomain(input);
        if (!domain) {
            return {};
        }

        const httpsResult = await fetchWebsite(domain, 'https');
        const website = httpsResult ?? (await fetchWebsite(domain, 'http'));
        if (!website) {
            return { companyDomain: domain };
        }

        const combinedPayload = `${website.html}\n${JSON.stringify(website.headers)}`;
        const technologies = detectTechnologies(combinedPayload);

        return {
            companyDomain: domain,
            technologies,
            metadata: {
                finalUrl: website.finalUrl,
                headers: website.headers,
            },
        };
    }
}

export const domainProvider = new DomainProvider();

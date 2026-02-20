export type ObjectionType =
    | 'PRICE'
    | 'TIMING'
    | 'AUTHORITY'
    | 'COMPETITOR'
    | 'NO_INTEREST'
    | 'TRUST'
    | 'OTHER';

export interface ObjectionDetectionResult {
    type: ObjectionType;
    confidence: number;
    matchedKeywords: string[];
}

interface ObjectionRule {
    type: ObjectionType;
    patterns: Array<{ keyword: string; regex: RegExp }>;
}

const RULES: ObjectionRule[] = [
    {
        type: 'PRICE',
        patterns: [
            { keyword: 'preco', regex: /\bpreco\b|\bvalor\b|\bcusto\b|\borcamento\b/i },
            { keyword: 'caro', regex: /\bcaro\b|\bmuito alto\b|\btoo expensive\b|\bexpensive\b/i },
            { keyword: 'desconto', regex: /\bdesconto\b|\bdiscount\b|\bmais barato\b/i },
        ],
    },
    {
        type: 'TIMING',
        patterns: [
            { keyword: 'agora nao', regex: /\bagora nao\b|\bnot now\b|\bnesse momento\b/i },
            { keyword: 'depois', regex: /\bdepois\b|\bmais pra frente\b|\bnext quarter\b|\blater\b/i },
            { keyword: 'sem tempo', regex: /\bsem tempo\b|\bsem prioridade\b|\bno time\b/i },
        ],
    },
    {
        type: 'AUTHORITY',
        patterns: [
            { keyword: 'decisor', regex: /\bnao sou o decisor\b|\bquem decide\b|\bdecision maker\b/i },
            { keyword: 'aprovar', regex: /\baprovar\b|\baprovacao\b|\bapproval\b|\bpreciso alinhar\b/i },
            { keyword: 'diretoria', regex: /\bdiretoria\b|\bgestor\b|\bboard\b/i },
        ],
    },
    {
        type: 'COMPETITOR',
        patterns: [
            { keyword: 'fornecedor atual', regex: /\bja usamos\b|\bfornecedor atual\b|\balready use\b/i },
            { keyword: 'concorrente', regex: /\bconcorrente\b|\boutra ferramenta\b|\bother tool\b/i },
            { keyword: 'contrato', regex: /\bcontrato\b|\bvinculado\b|\blocked in\b/i },
        ],
    },
    {
        type: 'NO_INTEREST',
        patterns: [
            { keyword: 'sem interesse', regex: /\bsem interesse\b|\bnao tenho interesse\b|\bnot interested\b/i },
            { keyword: 'remover', regex: /\bremover\b|\bpare de enviar\b|\bunsubscribe\b/i },
            { keyword: 'nao faz sentido', regex: /\bnao faz sentido\b|\bnot relevant\b/i },
        ],
    },
    {
        type: 'TRUST',
        patterns: [
            { keyword: 'confianca', regex: /\bconfianca\b|\bcredibilidade\b|\btrust\b/i },
            { keyword: 'seguranca', regex: /\bseguranca\b|\brisco\b|\bsecurity\b|\bcompliance\b/i },
            { keyword: 'prova', regex: /\bcase\b|\bdepoimento\b|\breferencia\b|\bproof\b/i },
        ],
    },
];

export function detectObjection(message: string): ObjectionDetectionResult | null {
    const content = message.trim();
    if (!content) {
        return null;
    }

    let best: ObjectionDetectionResult | null = null;

    for (const rule of RULES) {
        const matchedKeywords = rule.patterns
            .filter((pattern) => pattern.regex.test(content))
            .map((pattern) => pattern.keyword);

        if (matchedKeywords.length === 0) {
            continue;
        }

        const confidence = Math.min(0.95, 0.35 + matchedKeywords.length * 0.25);
        const candidate: ObjectionDetectionResult = {
            type: rule.type,
            confidence: Number(confidence.toFixed(2)),
            matchedKeywords,
        };

        if (!best || candidate.confidence > best.confidence) {
            best = candidate;
        }
    }

    if (best) {
        return best;
    }

    if (content.length >= 8 && /\?/.test(content)) {
        return {
            type: 'OTHER',
            confidence: 0.4,
            matchedKeywords: ['question'],
        };
    }

    return null;
}

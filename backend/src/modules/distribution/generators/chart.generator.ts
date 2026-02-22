interface SignalSeed {
    insight: string;
    dataPoints: number;
    type: string;
    rawData?: unknown;
}

interface ChartSeries {
    title: string;
    labels: string[];
    values: number[];
    unit: '%' | 'count';
}

const QUICK_CHART_BASE_URL = 'https://quickchart.io/chart';
const IMAGE_URL_PATTERN = /https:\/\/quickchart\.io\/chart\?[^)\s]+/i;

function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function toString(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return fallback;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function asPercent(value: number) {
    const normalized = value <= 1 ? value * 100 : value;
    return Number(clamp(normalized, 0, 100).toFixed(2));
}

function normalizeCategory(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return 'unknown';
    }
    return normalized[0].toUpperCase() + normalized.slice(1);
}

function extractTimingSeries(rawData: Record<string, unknown>): ChartSeries | null {
    const topBuckets = rawData['topBuckets'];
    if (!Array.isArray(topBuckets) || topBuckets.length === 0) {
        return null;
    }

    const rows = topBuckets
        .map((item) => toRecord(item))
        .map((item) => {
            const dayLabel = toString(item['dayLabel'], 'dia');
            const hour = toNumber(item['hour']) ?? 0;
            const rate = toNumber(item['replyRate']);
            return {
                label: `${dayLabel.slice(0, 3)} ${String(Math.round(hour)).padStart(2, '0')}h`,
                value: rate !== null ? asPercent(rate) : null,
            };
        })
        .filter((item): item is { label: string; value: number } => item.value !== null)
        .slice(0, 8);

    if (rows.length === 0) {
        return null;
    }

    return {
        title: 'Reply rate por janela',
        labels: rows.map((row) => row.label),
        values: rows.map((row) => row.value),
        unit: '%',
    };
}

function extractChannelSeries(rawData: Record<string, unknown>): ChartSeries | null {
    const winner = toRecord(rawData['winner']);
    const loser = toRecord(rawData['loser']);

    const winnerChannel = toString(winner['channel']);
    const loserChannel = toString(loser['channel']);
    const winnerRate = toNumber(winner['replyRate']);
    const loserRate = toNumber(loser['replyRate']);

    if (!winnerChannel || !loserChannel || winnerRate === null || loserRate === null) {
        return null;
    }

    return {
        title: 'Comparativo de canais',
        labels: [winnerChannel, loserChannel].map((value) => normalizeCategory(value)),
        values: [asPercent(winnerRate), asPercent(loserRate)],
        unit: '%',
    };
}

function extractIcpSeries(rawData: Record<string, unknown>): ChartSeries | null {
    const topSegments = rawData['topSegments'];
    if (!Array.isArray(topSegments) || topSegments.length === 0) {
        return null;
    }

    const rows = topSegments
        .map((item) => toRecord(item))
        .map((item) => {
            const industry = toString(item['industry'], 'unknown');
            const companySize = toString(item['companySize'], 'unknown');
            const rate = toNumber(item['conversionRate']);
            return {
                label: `${industry}/${companySize}`.slice(0, 20),
                value: rate !== null ? asPercent(rate) : null,
            };
        })
        .filter((item): item is { label: string; value: number } => item.value !== null)
        .slice(0, 6);

    if (rows.length === 0) {
        return null;
    }

    return {
        title: 'Conversao por segmento ICP',
        labels: rows.map((row) => row.label),
        values: rows.map((row) => row.value),
        unit: '%',
    };
}

function extractMessageSeries(rawData: Record<string, unknown>): ChartSeries | null {
    const topSteps = rawData['topSteps'];
    if (!Array.isArray(topSteps) || topSteps.length === 0) {
        return null;
    }

    const rows = topSteps
        .map((item) => toRecord(item))
        .map((item, index) => {
            const preview = toString(item['contentPreview'], `step ${index + 1}`);
            const rate = toNumber(item['replyRate']);
            return {
                label: preview.slice(0, 24),
                value: rate !== null ? asPercent(rate) : null,
            };
        })
        .filter((item): item is { label: string; value: number } => item.value !== null)
        .slice(0, 5);

    if (rows.length === 0) {
        return null;
    }

    return {
        title: 'Reply rate por template',
        labels: rows.map((row) => row.label),
        values: rows.map((row) => row.value),
        unit: '%',
    };
}

function extractObjectionSeries(rawData: Record<string, unknown>): ChartSeries | null {
    const categories = rawData['categories'];
    if (!Array.isArray(categories) || categories.length === 0) {
        return null;
    }

    const rows = categories
        .map((item) => toRecord(item))
        .map((item) => {
            const category = toString(item['category']);
            const count = toNumber(item['count']);
            return {
                label: normalizeCategory(category),
                value: count,
            };
        })
        .filter((item): item is { label: string; value: number } => item.value !== null)
        .slice(0, 6);

    if (rows.length === 0) {
        return null;
    }

    return {
        title: 'Objecoes por categoria',
        labels: rows.map((row) => row.label),
        values: rows.map((row) => Number(row.value.toFixed(0))),
        unit: 'count',
    };
}

function extractConversionSeries(rawData: Record<string, unknown>): ChartSeries | null {
    const distribution = rawData['touchpointDistribution'];
    if (!Array.isArray(distribution) || distribution.length === 0) {
        return null;
    }

    const histogram = new Map<number, number>();
    for (const item of distribution) {
        const value = toNumber(item);
        if (value === null) {
            continue;
        }
        const bucket = clamp(Math.round(value), 0, 20);
        histogram.set(bucket, (histogram.get(bucket) || 0) + 1);
    }

    const rows = Array.from(histogram.entries())
        .sort((a, b) => a[0] - b[0])
        .slice(0, 10)
        .map(([bucket, count]) => ({
            label: `${bucket} toques`,
            value: count,
        }));

    if (rows.length === 0) {
        return null;
    }

    return {
        title: 'Distribuicao de touchpoints',
        labels: rows.map((row) => row.label),
        values: rows.map((row) => row.value),
        unit: 'count',
    };
}

function fallbackSeries(signal: SignalSeed): ChartSeries {
    return {
        title: `Signal ${signal.type}`,
        labels: ['Data points'],
        values: [signal.dataPoints],
        unit: 'count',
    };
}

function pickSeries(signal: SignalSeed): ChartSeries {
    const rawData = toRecord(signal.rawData);

    return (
        extractTimingSeries(rawData) ||
        extractChannelSeries(rawData) ||
        extractIcpSeries(rawData) ||
        extractMessageSeries(rawData) ||
        extractObjectionSeries(rawData) ||
        extractConversionSeries(rawData) ||
        fallbackSeries(signal)
    );
}

function buildQuickChartUrl(series: ChartSeries, signal: SignalSeed) {
    const axisLabel = series.unit === '%' ? 'Reply rate (%)' : 'Quantidade';
    const chartConfig = {
        type: 'bar',
        data: {
            labels: series.labels,
            datasets: [
                {
                    label: axisLabel,
                    data: series.values,
                    backgroundColor: '#2563eb',
                    borderColor: '#1d4ed8',
                    borderWidth: 1,
                    borderRadius: 6,
                },
            ],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: `${series.title} | ${signal.type}`,
                },
                subtitle: {
                    display: true,
                    text: signal.insight.slice(0, 120),
                },
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: series.unit === '%' ? 100 : undefined,
                },
            },
        },
    };

    const encoded = encodeURIComponent(JSON.stringify(chartConfig));
    return `${QUICK_CHART_BASE_URL}?format=png&width=1024&height=512&devicePixelRatio=2&c=${encoded}`;
}

export function extractChartImageUrl(content: string): string | null {
    const match = content.match(IMAGE_URL_PATTERN);
    return match?.[0] || null;
}

export function generateChart(signal: SignalSeed): string {
    const series = pickSeries(signal);
    const imageUrl = buildQuickChartUrl(series, signal);

    return [
        `Signal chart: ${series.title}`,
        `Insight: ${signal.insight}`,
        `Data points: ${signal.dataPoints}`,
        `PNG: ${imageUrl}`,
    ].join('\n');
}

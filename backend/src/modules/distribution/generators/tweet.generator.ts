interface SignalSeed {
    insight: string;
    dataPoints: number;
    type: string;
}

export function generateTweet(signal: SignalSeed): string {
    const base = `Analisei ${signal.dataPoints} interacoes. Insight: ${signal.insight}`;
    if (base.length <= 280) {
        return base;
    }
    return `${base.slice(0, 276)}...`;
}

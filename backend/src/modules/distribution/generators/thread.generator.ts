interface SignalSeed {
    insight: string;
    dataPoints: number;
    type: string;
}

export function generateThread(signal: SignalSeed): string {
    const lines = [
        `1/3 Rodei uma analise com ${signal.dataPoints} interacoes do meu outbound.`,
        `2/3 Principal sinal (${signal.type}): ${signal.insight}`,
        '3/3 Acao pratica: ajuste canal, timing e segmento com base nesse padrao e monitore por 2 semanas.',
    ];

    return lines.join('\n');
}

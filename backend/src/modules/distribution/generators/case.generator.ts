interface SignalSeed {
    insight: string;
    dataPoints: number;
    type: string;
}

export function generateCase(signal: SignalSeed): string {
    return [
        'Micro-case anonimo:',
        `Segmento analisado: ${signal.type}`,
        `Base: ${signal.dataPoints} interacoes.`,
        `Resultado: ${signal.insight}`,
        'Aplicacao: reaplique o padrao em contas similares e compare reply rate semanal.',
    ].join(' ');
}

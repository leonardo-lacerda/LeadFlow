"use client";

const steps = [
    {
        title: "1. Cada SaaS conecta sua operacao",
        description:
            "ICP, canais usados, resultados e respostas entram no sistema com anonimização desde a origem.",
    },
    {
        title: "2. O Signal Layer aprende padroes",
        description:
            "O motor identifica timing, perfil e canal com maior chance de resposta por segmento semelhante.",
    },
    {
        title: "3. Cada org recebe inteligencia acionavel",
        description:
            "Score, timing e contexto para priorizar abordagem. A execucao continua sob controle do seu time.",
    },
];

export function LandingHowItWorks() {
    return (
        <section id="how-it-works" className="py-24">
            <div className="container mx-auto px-4">
                <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.24em] text-indigo-300 mb-3">
                        Modelo tecnico
                    </p>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Como o Leadflow transforma aquisicao em infraestrutura
                    </h2>
                    <p className="text-gray-400">
                        O objetivo nao e distribuir o mesmo lead para todo mundo. O objetivo e
                        compartilhar aprendizado de mercado para cada org decidir melhor.
                    </p>
                </div>

                <div className="mt-12 grid gap-6 md:grid-cols-3">
                    {steps.map((step) => (
                        <div
                            key={step.title}
                            className="rounded-2xl border border-white/10 bg-gray-900/40 p-6"
                        >
                            <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-sm text-gray-300">
                        Regra de ouro: <span className="text-white font-semibold">ninguem recebe lead direto de outra org.</span>
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                        O produto entrega sinais, scores e recomendacoes de timing. Isso protege qualidade, evita spam e cria data moat real.
                    </p>
                </div>
            </div>
        </section>
    );
}

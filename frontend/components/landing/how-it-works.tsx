"use client";

import { IconArrowDown } from "@tabler/icons-react";

const steps = [
    {
        title: "1 // Outbound",
        subtitle: "Aquisicao",
        description:
            "O Lastreia fornece os leads (emails e CNPJ) e a infraestrutura do inbox. Voce realiza a prospeccao normalmente. Nenhuma mudanca no seu fluxo de trabalho.",
    },
    {
        title: "2 // Pattern Recognition",
        subtitle: "Inteligencia",
        description:
            "O Signal Engine intercepta eventos (opens, replies, bounces). Ele cruza os atributos do lead com o timing e canal para detectar correlacoes ocultas de conversao.",
    },
    {
        title: "3 // Distribution",
        subtitle: "Visibilidade",
        description:
            "O motor traduz esses padroes validados matematicamente em drafts de conteudos sociais (LinkedIn/X). O marketing torna-se um output deterministico das vendas.",
    },
];

export function LandingHowItWorks() {
    return (
        <section id="how-it-works" className="py-24 bg-black border-t border-white/5 relative">
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mb-16">
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
                        <span className="w-4 h-px bg-gray-600 block" /> Loop Virtuoso
                    </p>
                    <h2 className="text-4xl md:text-5xl font-semibold text-white mb-6 tracking-tight">
                        A anatomia do Signal Engine
                    </h2>
                    <p className="text-gray-400 font-light text-lg">
                        Sua operacao comercial e um motor de insights que ninguem esta publicando.
                        Nos conectamos a saida do CRM diretamente na entrada das suas redes.
                    </p>
                </div>

                <div className="relative max-w-5xl mx-auto">
                    {/* Connecting line for desktop */}
                    <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <div className="grid gap-8 md:grid-cols-3 relative z-10">
                        {steps.map((step, idx) => (
                            <div
                                key={step.title}
                                className="relative flex flex-col"
                            >
                                <div className="h-14 w-14 rounded-full bg-black border border-white/20 flex items-center justify-center font-mono text-sm text-white mb-6 mx-auto md:mx-0 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                                    0{idx + 1}
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="text-xs font-mono text-gray-500 mb-1">{step.subtitle}</div>
                                    <h3 className="text-xl font-medium text-white mb-3">{step.title}</h3>
                                    <p className="text-sm text-gray-400/90 leading-relaxed font-light">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-20 max-w-4xl mx-auto rounded-xl border border-white/10 bg-[#0a0a0a] p-8 text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                    <p className="text-sm text-gray-300 font-medium z-10 relative">
                        Output final
                    </p>
                    <IconArrowDown className="h-5 w-5 text-gray-600 mx-auto my-4 z-10 relative" />
                    <p className="text-base md:text-lg text-white font-light z-10 relative">
                        A distribuicao de dados atrai <span className="font-medium text-white">novos leads inbound</span> de forma organica e com custo zero, baixando drasticamente seu CAC global.
                    </p>
                </div>
            </div>
        </section>
    );
}



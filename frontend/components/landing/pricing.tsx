"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
    {
        name: "Base",
        price: "R$ 299",
        description: "Operacao de vendas com leads, inteligencia individual e CRM basico.",
        features: [
            "Leads ilimitados do Pool",
            "1 organizacao/usuario",
            "Score e Inteligencia basica",
            "Disparos Email e WhatsApp",
            "Suporte da comunidade",
        ],
    },
    {
        name: "Distribution",
        price: "R$ 799",
        popular: true,
        description: "Acesso ao Signal Engine para automatizar a geracao do seu conteudo.",
        features: [
            "Tudo do plano Base",
            "Signal Engine ativo",
            "Geracao de templates de posts",
            "Sinais compartilhados pela rede",
            "Exportacao de charts (Data Moat)",
            "Suporte prioritario",
        ],
    },
    {
        name: "Infra",
        price: "Custom",
        description: "Para operacoes e SDRs que geram muito volume e precisam escalar a rede.",
        features: [
            "White labeling de Distribution",
            "Ate 20 usuarios",
            "Integracoes (Salesforce, Hubspot)",
            "SLA e onboarding tecnico",
            "Acesso direto as APIs",
        ],
    },
];

export function LandingPricing() {
    return (
        <section id="pricing" className="py-24 bg-black border-t border-white/5 relative">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center justify-center gap-2">
                        <span className="w-4 h-px bg-gray-600 block" /> Pricing
                    </p>
                    <h2 className="text-4xl md:text-5xl font-semibold text-white mb-6 tracking-tight">
                        Ferramentas geram listas. <br />
                        <span className="text-gray-500">A infraestrutura gera clientes.</span>
                    </h2>
                    <p className="text-gray-400 font-light text-lg">
                        Acesso aos canais, leads estruturados no pool coletivo,
                        e um engine voltado pra tornar voces a autoridade no seu segmento.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-xl border p-8 bg-[#0a0a0a] transition-all hover:border-white/30 flex flex-col ${plan.popular ? "border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.03)]" : "border-white/10"
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-8 bg-white text-black px-3 py-0.5 rounded-full text-xs font-mono font-medium">
                                    Recomendado
                                </div>
                            )}

                            <div className="mb-8 flex-1">
                                <h3 className="text-lg font-mono text-gray-300 mb-4">{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-4xl font-semibold text-white tracking-tight">{plan.price}</span>
                                    {plan.price !== "Custom" ? (
                                        <span className="text-gray-500 font-mono text-sm">/mo</span>
                                    ) : null}
                                </div>
                                <p className="text-gray-400 text-sm font-light leading-relaxed h-12">{plan.description}</p>
                            </div>

                            <div className="mb-8">
                                <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent mb-6" />
                                <ul className="space-y-4">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-gray-300 font-light">
                                            <Check className="h-4 w-4 text-white mt-0.5 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Button
                                className={`w-full rounded-none h-11 font-medium text-sm transition-colors ${plan.popular
                                        ? "bg-white text-black hover:bg-gray-200"
                                        : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                                    }`}
                                variant={plan.popular ? "default" : "outline"}
                            >
                                Get Started
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}



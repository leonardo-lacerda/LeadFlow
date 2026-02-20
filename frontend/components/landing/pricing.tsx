"use client";

import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
    {
        name: "Builder",
        price: "R$ 299",
        description: "Para SaaS B2B pequenos iniciando operacao com sinais compartilhados.",
        features: [
            "25.000 sinais analisados/mes",
            "1 organizacao",
            "Acesso ao Lead Pool base",
            "Score de timing e canal",
            "Suporte por email",
        ],
    },
    {
        name: "Network",
        price: "R$ 799",
        popular: true,
        description: "Para times com volume constante e foco em previsibilidade de aquisicao.",
        features: [
            "120.000 sinais analisados/mes",
            "Ate 5 usuarios",
            "Signal Layer avancado",
            "Alertas de intencao por segmento",
            "Benchmark anonimo por cohort",
            "Suporte prioritario",
        ],
    },
    {
        name: "Infra",
        price: "Sob consulta",
        description: "Para operacoes com multiplas squads e necessidade de governanca de dados.",
        features: [
            "Volume customizado de sinais",
            "Ate 20 usuarios",
            "Pools dedicados por vertical",
            "SLA e onboarding tecnico",
            "Integrações e API avancada",
        ],
    },
];

export function LandingPricing() {
    return (
        <section id="pricing" className="py-24 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Planos baseados em sinais e tamanho da org
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Voce nao paga por lista de leads. Voce paga pela infraestrutura que melhora sua decisao comercial.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-2xl border p-8 backdrop-blur-sm ${plan.popular
                                ? "border-indigo-500 bg-gray-900/80 shadow-2xl shadow-indigo-500/20"
                                : "border-white/10 bg-gray-900/40 hover:border-white/20"
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                                    Cohort recomendado
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                                    {plan.price !== "Sob consulta" ? (
                                        <span className="text-gray-400">/mes</span>
                                    ) : null}
                                </div>
                                <p className="text-gray-400 mt-4 text-sm">{plan.description}</p>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
                                        <Check className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <Button
                                className={`w-full ${plan.popular
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                    : "bg-white/10 hover:bg-white/20 text-white"
                                    }`}
                            >
                                Selecionar plano
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

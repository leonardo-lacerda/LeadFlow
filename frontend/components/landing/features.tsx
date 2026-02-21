"use client";

import {
    IconSearch,
    IconMail,
    IconRobot,
    IconDatabase,
} from "@tabler/icons-react";
import { MoveUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
    {
        title: "Base Compartilhada de Leads",
        description: "Base viva de leads B2B para iniciar a operacao sem depender de scraping isolado em cada org.",
        icon: <IconSearch className="h-8 w-8 text-indigo-400" />,
        className: "md:col-span-2",
        bgClass: "bg-indigo-500/10",
    },
    {
        title: "Camada de Sinais",
        description: "Agrega respostas anonimizadas por segmento e transforma tentativa e erro em padrao reutilizavel.",
        icon: <IconDatabase className="h-8 w-8 text-purple-400" />,
        className: "md:col-span-1",
        bgClass: "bg-purple-500/10",
    },
    {
        title: "Momento + Score de Canal",
        description: "Recomenda o melhor dia, horario e canal para cada perfil com base em performance coletiva.",
        icon: <IconMail className="h-8 w-8 text-pink-400" />,
        className: "md:col-span-1",
        bgClass: "bg-pink-500/10",
    },
    {
        title: "Aprendizado Coletivo",
        description: "Quanto mais SaaS B2B participam, maior a precisao dos sinais e menor o CAC individual.",
        icon: <IconRobot className="h-8 w-8 text-blue-400" />,
        className: "md:col-span-2",
        bgClass: "bg-blue-500/10",
    },
];

export function LandingFeatures() {
    return (
        <section id="signal-layer" className="py-24 bg-black/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Infra coletiva de aquisicao B2B <br />
                        <span className="text-gray-400">para SaaS que querem parar de aprender sozinhos.</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Nao e marketplace de leads. E uma camada de inteligencia compartilhada
                        que orienta decisoes comerciais com sinais reais de mercado.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "group relative overflow-hidden rounded-2xl border border-white/10 bg-gray-900/50 p-8 hover:border-white/20 transition-all hover:bg-gray-900/80",
                                feature.className
                            )}
                        >
                            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity", feature.bgClass)} />

                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div>
                                    <div className="mb-4 p-3 bg-white/5 rounded-lg w-fit">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-400 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>

                                <div className="mt-8 flex items-center text-sm font-medium text-white/50 group-hover:text-white transition-colors cursor-pointer">
                                    Ver camada <MoveUpRight className="ml-2 h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}



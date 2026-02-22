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
        title: "1. Camada de Leads",
        description: "A base real da sua operacao. Base viva com e-mails, telefones e enriquecimento automatico. Porque sem prospect, nao tem negocio.",
        icon: <IconSearch className="h-5 w-5 text-gray-300" />,
        className: "md:col-span-2",
        bgClass: "bg-gradient-to-br from-white/[0.03] to-transparent",
    },
    {
        title: "2. Camada de Inteligencia",
        description: "Scores dinamicos e temperatura baseados em resultados reais agregados de todas as campanhas do sistema.",
        icon: <IconDatabase className="h-5 w-5 text-gray-300" />,
        className: "md:col-span-1",
        bgClass: "bg-gradient-to-br from-white/[0.03] to-transparent",
    },
    {
        title: "3. O Signal Engine",
        description: "Transforma 200 emails enviados em insights claros: \"CTOs respondem mais as tercas 10h\". Dados estruturados na sua tela.",
        icon: <IconRobot className="h-5 w-5 text-gray-300" />,
        className: "md:col-span-1",
        bgClass: "bg-gradient-to-br from-white/[0.03] to-transparent",
    },
    {
        title: "4. Visibilidade (Distribution)",
        description: "O sistema gera automaticamente templates de tweets, threads e imagens pra voce postar. O outbound alimenta o inbound.",
        icon: <IconMail className="h-5 w-5 text-gray-300" />,
        className: "md:col-span-2",
        bgClass: "bg-gradient-to-br from-white/[0.03] to-transparent",
    },
];

export function LandingFeatures() {
    return (
        <section id="signal-engine" className="py-24 bg-black border-t border-white/5 relative overflow-hidden">
            {/* Minimalist grid overlay top section only */}
            <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="container mx-auto px-4">
                <div className="mb-16">
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
                        <span className="w-4 h-px bg-gray-600 block" /> Core Engine
                    </p>
                    <h2 className="text-4xl md:text-5xl font-semibold text-white mb-6 tracking-tight">
                        Outbound que gera <br />
                        <span className="text-gray-500">seu proprio marketing.</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl font-light text-lg">
                        Dezenas de insights valiosos morrem no backend todo dia.
                        O Leadflow escuta a sua operacao e gera o seu conteudo de autoridade
                        baseado em dados anonimizados da rede.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {features.map((feature, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "group relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] hover:border-white/30 transition-all duration-500 p-8",
                                feature.className
                            )}
                        >
                            <div className={cn("absolute inset-0 opacity-100 transition-opacity", feature.bgClass)} />

                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoveUpRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
                            </div>

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="mb-6 p-2.5 bg-white/5 border border-white/10 rounded-md w-fit text-white">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="text-xl font-medium text-white mb-3">
                                        {feature.title}
                                    </h3>
                                    <p className="text-sm text-gray-400/90 leading-relaxed font-light">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}



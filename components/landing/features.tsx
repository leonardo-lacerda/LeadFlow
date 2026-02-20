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
        title: "Busca de Leads B2B",
        description: "Acesse uma base com mais de 200 milhões de contatos verificados. Filtre por cargo, setor, localização e tamanho da empresa.",
        icon: <IconSearch className="h-8 w-8 text-indigo-400" />,
        className: "md:col-span-2",
        bgClass: "bg-indigo-500/10",
    },
    {
        title: "Enriquecimento de Dados",
        description: "Transforme emails incompletos em perfis detalhados. Validamos emails e telefones em tempo real.",
        icon: <IconDatabase className="h-8 w-8 text-purple-400" />,
        className: "md:col-span-1",
        bgClass: "bg-purple-500/10",
    },
    {
        title: "Campanhas Multicanal",
        description: "Crie sequências automatizadas que combinam Email e WhatsApp para aumentar sua taxa de resposta em até 3x.",
        icon: <IconMail className="h-8 w-8 text-pink-400" />,
        className: "md:col-span-1",
        bgClass: "bg-pink-500/10",
    },
    {
        title: "Assistente de IA",
        description: "Nossa IA gera copies personalizadas para cada prospect, analisando o perfil do LinkedIn e site da empresa.",
        icon: <IconRobot className="h-8 w-8 text-blue-400" />,
        className: "md:col-span-2",
        bgClass: "bg-blue-500/10",
    },
];

export function LandingFeatures() {
    return (
        <section id="features" className="py-24 bg-black/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Tudo que você precisa para <br />
                        <span className="text-gray-400">vendar mais, em um só lugar.</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Elimine a necessidade de múltiplas ferramentas. O Leadflow centraliza
                        prospecção, enriquecimento e outreach.
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
                                    Saiba mais <MoveUpRight className="ml-2 h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

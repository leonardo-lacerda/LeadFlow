"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { IconRocket, IconCheck } from "@tabler/icons-react";

export function LandingHero() {
    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-300 mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Novo: Integração com WhatsApp Oficial
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-6"
                >
                    Automatize sua Prospecção <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                        com Inteligência Artificial
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10"
                >
                    Encontre leads qualificados, enriqueça dados e envie campanhas multicanal
                    (Email + WhatsApp) em uma única plataforma integrada.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <Link href="/register">
                        <Button size="lg" className="h-12 px-8 text-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-full">
                            <IconRocket className="mr-2 h-5 w-5" />
                            Começar Teste Grátis
                        </Button>
                    </Link>
                    <Link href="#demo">
                        <Button size="lg" variant="outline" className="h-12 px-8 text-lg border-white/20 text-white hover:bg-white/10 rounded-full">
                            Ver Demonstração
                        </Button>
                    </Link>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500"
                >
                    <div className="flex items-center gap-2">
                        <IconCheck className="h-4 w-4 text-green-500" />
                        <span>Sem cartão necessário</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <IconCheck className="h-4 w-4 text-green-500" />
                        <span>Setup em 2 minutos</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <IconCheck className="h-4 w-4 text-green-500" />
                        <span>Suporte Brasileiro 🇧🇷</span>
                    </div>
                </motion.div>
            </div>

            {/* Dashboard Preview (Abstract) */}
            <motion.div
                initial={{ opacity: 0, y: 100, rotateX: 20 }}
                animate={{ opacity: 1, y: 0, rotateX: 10 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="container mx-auto px-4 mt-16 perspective-[1000px]"
            >
                <div className="relative rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm shadow-2xl overflow-hidden aspect-video transform rotate-x-12 hover:rotate-x-0 transition-transform duration-700">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10" />
                    {/* Placeholder for actual dashboard screenshot */}
                    <div className="grid grid-cols-12 gap-4 p-8 h-full opacity-50">
                        <div className="col-span-3 bg-white/5 rounded-lg h-full" />
                        <div className="col-span-9 flex flex-col gap-4 h-full">
                            <div className="h-20 bg-white/5 rounded-lg w-full" />
                            <div className="flex-1 bg-white/5 rounded-lg w-full" />
                        </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="px-4 py-2 bg-black/50 backdrop-blur rounded-full text-white/50 text-sm border border-white/10">
                            Dashboard Preview
                        </span>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}

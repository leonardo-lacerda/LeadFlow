"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { IconRocket, IconCheck } from "@tabler/icons-react";

export function LandingHero() {
    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
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
                        Novo posicionamento: Aquisicao como Infraestrutura
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-6"
                >
                    Aquisicao como Infraestrutura. <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                        Sinais, nao leads.
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10"
                >
                    O Leadflow conecta sinais anonimizados entre SaaS B2B com ICP parecido
                    para indicar quem abordar, quando abordar e qual canal converte melhor.
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
                            Entrar no Grupo Inicial
                        </Button>
                    </Link>
                    <Link href="#how-it-works">
                        <Button size="lg" variant="outline" className="h-12 px-8 text-lg border-white/20 text-white hover:bg-white/10 rounded-full">
                            Ver Camada de Sinais
                        </Button>
                    </Link>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500"
                >
                    <div className="flex items-center gap-2">
                        <IconCheck className="h-4 w-4 text-green-500" />
                        <span>Sinais, nao leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <IconCheck className="h-4 w-4 text-green-500" />
                        <span>Dados anonimizados por padrao</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <IconCheck className="h-4 w-4 text-green-500" />
                        <span>Foco em SaaS B2B</span>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
                >
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-2xl font-bold text-white">4.2M+</p>
                        <p className="text-xs text-gray-400">sinais compartilhados na rede</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-2xl font-bold text-white">186</p>
                        <p className="text-xs text-gray-400">SaaS B2B ativos no cohort tecnico</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-2xl font-bold text-white">+31%</p>
                        <p className="text-xs text-gray-400">aumento medio de respostas com timing recomendado</p>
                    </div>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 100, rotateX: 20 }}
                animate={{ opacity: 1, y: 0, rotateX: 10 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="container mx-auto px-4 mt-16 perspective-[1000px]"
            >
                <div className="relative rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm shadow-2xl overflow-hidden aspect-video transform rotate-x-12 hover:rotate-x-0 transition-transform duration-700">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10" />
                    <div className="grid grid-cols-12 gap-4 p-8 h-full opacity-50">
                        <div className="col-span-3 bg-white/5 rounded-lg h-full" />
                        <div className="col-span-9 flex flex-col gap-4 h-full">
                            <div className="h-20 bg-white/5 rounded-lg w-full" />
                            <div className="flex-1 bg-white/5 rounded-lg w-full" />
                        </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="px-4 py-2 bg-black/50 backdrop-blur rounded-full text-white/50 text-sm border border-white/10">
                            Previa da Camada de Sinais
                        </span>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}


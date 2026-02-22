"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { IconChevronRight, IconTerminal2 } from "@tabler/icons-react";

export function LandingHero() {
    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-black selection:bg-white/30">
            {/* Minimalist Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

            {/* Subtle top spotlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/5 blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex justify-center"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-300 mb-8 backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Signal Engine v2.0
                        <div className="h-3 w-px bg-white/20 mx-1" />
                        <span className="text-gray-500">Read docs</span>
                        <IconChevronRight className="h-3 w-3" />
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="text-5xl md:text-7xl font-semibold text-white tracking-tighter mb-6 leading-[1.1]"
                >
                    Seu sistema comercial <br className="hidden md:block" />
                    deveria falar em publico.
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 font-light"
                >
                    O Leadflow transforma seu esforco de outbound em conteudo de distribuicao.
                    Aquisicao como infraestrutura: capte leads, descubra padroes,
                    e gere posts validados por dados para atrair mais clientes.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <Link href="/register">
                        <Button size="lg" className="h-12 px-8 text-base bg-white text-black hover:bg-gray-200 rounded-none font-medium">
                            <IconTerminal2 className="mr-2 h-4 w-4" />
                            Inicializar Engine
                        </Button>
                    </Link>
                    <Link href="#signal-engine">
                        <Button size="lg" variant="outline" className="h-12 px-8 text-base rounded-none border-white/10 text-white hover:bg-white/5 font-medium">
                            Documentacao
                        </Button>
                    </Link>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="mt-20 max-w-4xl mx-auto"
                >
                    <div className="relative rounded-lg border border-white/10 bg-black shadow-2xl shadow-white/[0.02] overflow-hidden group">
                        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/50" />
                                <div className="h-3 w-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                                <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500/50" />
                            </div>
                            <div className="text-xs font-mono text-gray-500 flex items-center gap-2">
                                <IconTerminal2 className="h-3 w-3" /> signal_engine_status.log
                            </div>
                            <div className="w-12" /> {/* Spacer */}
                        </div>

                        <div className="p-6 md:p-8 font-mono text-sm text-left overflow-x-auto bg-[#0a0a0a]">
                            <div className="text-gray-500 mb-2"># Analyzing recent outbound cohort_id=x7f9a</div>
                            <div className="text-white"><span className="text-indigo-400">SELECT</span> pattern <span className="text-indigo-400">FROM</span> outbound_events</div>
                            <div className="text-white"><span className="text-indigo-400">WHERE</span> segment = <span className="text-green-400">&apos;B2B SaaS CTO&apos;</span></div>
                            <div className="text-gray-400 mt-4">... analyzing 4,209 interactions</div>
                            <div className="text-gray-400">... pattern found with 84% confidence</div>
                            <div className="text-indigo-300 mt-4 border-l-2 border-indigo-500/50 pl-4 py-2 bg-indigo-500/10">
                                <span className="text-white block font-semibold mb-1">[SIGNAL DETECTED]</span>
                                Timing: Tuesdays at 10:00 AM<br />
                                Channel: WhatsApp (+47% reply rate)
                            </div>
                            <div className="text-gray-500 mt-4"># Generating distribution draft...</div>
                            <div className="flex items-center mt-2 group-hover:text-white transition-colors">
                                <span className="h-2 w-2 bg-white rounded-full animate-pulse mr-2" /> Ready to publish.
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

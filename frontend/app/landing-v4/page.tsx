"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { IBM_Plex_Mono, Sora } from "next/font/google";

const heading = Sora({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
});

const mono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

const PALETTE = {
    bg: "#ECE8E0",
    bgAlt: "#E3DFD6",
    surface: "#F9F6F0",
    surfaceSoft: "#F3EFE7",
    border: "#C8C0B1",
    text: "#1C2633",
    muted: "#4D5A6B",
    accent: "#1D4F91",
    accentSoft: "#DDE8F7",
    success: "#2D7B67",
};

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.55, ease: "easeOut" as const, delay },
});

const coreBlocks = [
    {
        title: "Lead sourcing",
        text: "Busca, organiza e segmenta leads de multiplas fontes.",
    },
    {
        title: "Enrichment automatico",
        text: "Completa contexto antes do primeiro contato.",
    },
    {
        title: "Campanhas multicanal",
        text: "Email, LinkedIn e outros canais no mesmo fluxo.",
    },
    {
        title: "Central de respostas",
        text: "Todas as respostas em uma unica caixa.",
    },
    {
        title: "Funil e metricas",
        text: "Pipeline e taxas reais para decidir o proximo passo.",
    },
];

const workflowSteps = [
    {
        step: "01",
        title: "Defina ICP e lista",
        action: "Voce escolhe segmento, porte e perfil.",
        output: "Lista priorizada.",
    },
    {
        step: "02",
        title: "Enriquece cada lead",
        action: "Lastreia adiciona contexto e dados de contato.",
        output: "Mensagem com contexto real.",
    },
    {
        step: "03",
        title: "Dispara campanha",
        action: "Sequencias multicanal sem trabalho manual repetitivo.",
        output: "Outbound rodando.",
    },
    {
        step: "04",
        title: "Captura eventos",
        action: "Replies, ignores, conversoes, canal, horario e ICP.",
        output: "Historico estruturado.",
    },
    {
        step: "05",
        title: "Detecta padroes",
        action: "Signal Engine cruza dados e valida confiabilidade.",
        output: "Insights acionaveis.",
    },
    {
        step: "06",
        title: "Gera distribuicao",
        action: "Transforma padrao validado em conteudo pronto.",
        output: "Autoridade + inbound.",
    },
];

const signalLayers = [
    {
        id: "Layer 01",
        title: "Event Capture",
        text: "Tudo que acontece no outbound vira evento imutavel.",
        points: ["replies", "ignores", "conversoes", "canal", "horario", "ICP"],
    },
    {
        id: "Layer 02",
        title: "Pattern Detector",
        text: "Padroes aparecem quando existe base e contraste.",
        points: ["confiabilidade minima de 50%", "analise por segmento", "sem achismo"],
    },
    {
        id: "Layer 03",
        title: "Distribution Generator",
        text: "Padrao validado vira ativo publico.",
        points: ["tweets", "threads", "graficos exportaveis", "micro-cases"],
    },
];

const fitYes = [
    "founders tecnicos",
    "SaaS B2B",
    "times pequenos de outbound",
    "quem quer vender sem virar guru",
];

const fitNo = ["spam", "lead marketplace", "post automatico", "promessas magicas"];

function SectionKicker({ children }: { children: ReactNode }) {
    return (
        <p className={`${mono.className} mb-4 text-xs uppercase tracking-[0.18em]`} style={{ color: PALETTE.muted }}>
            {children}
        </p>
    );
}

function SectionHeading({ children }: { children: ReactNode }) {
    return (
        <h2 className={`${heading.className} text-3xl font-bold tracking-tight md:text-5xl md:leading-[1.08]`} style={{ color: PALETTE.text }}>
            {children}
        </h2>
    );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={`rounded-2xl border p-6 md:p-7 ${className}`}
            style={{
                background: PALETTE.surface,
                borderColor: PALETTE.border,
                boxShadow: "0 10px 22px rgba(28,38,51,0.06)",
            }}
        >
            {children}
        </div>
    );
}

export default function LandingV4() {
    return (
        <div className={`${heading.className} min-h-screen`} style={{ background: PALETTE.bg }}>
            <div
                className="pointer-events-none fixed inset-0 opacity-80"
                style={{
                    background:
                        "radial-gradient(circle at 10% 10%, rgba(29,79,145,0.08) 0, transparent 36%), radial-gradient(circle at 90% 14%, rgba(45,123,103,0.07) 0, transparent 30%)",
                }}
            />

            <header
                className="fixed top-0 z-50 w-full border-b"
                style={{
                    background: "rgba(236,232,224,0.92)",
                    borderColor: PALETTE.border,
                    backdropFilter: "blur(8px)",
                }}
            >
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: PALETTE.text }}>Lastreia</span>
                        <span
                            className={`${mono.className} rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]`}
                            style={{ color: PALETTE.accent, background: PALETTE.accentSoft, borderColor: "#AEC2E2" }}
                        >
                            outbound + signal engine
                        </span>
                    </div>
                    <nav className="hidden items-center gap-6 md:flex">
                        {[
                            ["#o-que-faz", "O que faz"],
                            ["#como-funciona", "Como funciona"],
                            ["#signal-engine", "Signal"],
                            ["#cta-final", "Ativar"],
                        ].map(([href, label]) => (
                            <a
                                key={href}
                                href={href}
                                className={`${mono.className} text-xs uppercase tracking-[0.12em]`}
                                style={{ color: PALETTE.muted }}
                            >
                                {label}
                            </a>
                        ))}
                    </nav>
                </div>
            </header>

            <main className="relative z-10 pt-14">
                <section className="px-6 py-20 md:py-24">
                    <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
                        <motion.div {...fadeUp()}>
                            <SectionKicker>Visao Geral</SectionKicker>
                            <h1 className={`${heading.className} max-w-4xl text-4xl font-extrabold tracking-tight md:text-6xl md:leading-[1.04]`} style={{ color: PALETTE.text }}>
                                Lastreia faz outbound de ponta a ponta e transforma a operacao em sinais publicos.
                            </h1>
                            <p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: PALETTE.muted }}>
                                Em resumo: voce roda campanhas, concentra respostas, mede conversao e reaproveita todo
                                aprendizado para gerar autoridade e inbound.
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <a
                                    href="#cta-final"
                                    className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md px-6 text-xs font-semibold uppercase tracking-[0.14em]`}
                                    style={{ background: PALETTE.accent, color: "#F7FAFF" }}
                                >
                                    Ativar outbound inteligente
                                </a>
                                <a
                                    href="#como-funciona"
                                    className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md border px-6 text-xs uppercase tracking-[0.14em]`}
                                    style={{ borderColor: PALETTE.border, color: PALETTE.muted, background: PALETTE.surface }}
                                >
                                    Ver como funciona
                                </a>
                            </div>
                        </motion.div>

                        <motion.div {...fadeUp(0.1)}>
                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.14em]`} style={{ color: PALETTE.muted }}>
                                    Em uma frase
                                </p>
                                <p className="mt-4 text-lg leading-relaxed" style={{ color: PALETTE.text }}>
                                    Outbound e o motor. Dados sao o combustivel. Signals sao a vantagem.
                                </p>

                                <div className="mt-6 space-y-3">
                                    {[
                                        "voce nao perde o aprendizado de cada campanha",
                                        "cada iteracao melhora sua proxima campanha",
                                        "parte desse aprendizado vira distribuicao publica",
                                    ].map((item) => (
                                        <div key={item} className="flex items-start gap-3">
                                            <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.success }} />
                                            <p className="text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                                {item}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </motion.div>
                    </div>
                </section>

                <section id="o-que-faz" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>O Que o Sistema Faz</SectionKicker>
                        <SectionHeading>Fica claro em 3 blocos.</SectionHeading>
                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {[
                                {
                                    title: "1) Executa outbound",
                                    text: "Busca lead, enriquece, dispara campanha, centraliza resposta e mede conversao.",
                                },
                                {
                                    title: "2) Estrutura dados",
                                    text: "Cada reply, ignore e conversao vira evento tipado no historico da conta.",
                                },
                                {
                                    title: "3) Gera sinais",
                                    text: "Padroes validos viram conteudo objetivo para distribuicao e autoridade.",
                                },
                            ].map((block, index) => (
                                <motion.div key={block.title} {...fadeUp(index * 0.08)}>
                                    <Panel className="h-full">
                                        <h3 className="text-xl font-semibold" style={{ color: PALETTE.text }}>{block.title}</h3>
                                        <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                                            {block.text}
                                        </p>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="como-funciona" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Como Funciona na Pratica</SectionKicker>
                        <SectionHeading>Fluxo operacional em 6 passos.</SectionHeading>

                        <div className="mt-8 space-y-3">
                            {workflowSteps.map((step, index) => (
                                <motion.div key={step.step} {...fadeUp(index * 0.05)}>
                                    <Panel className="!p-5 md:!p-6">
                                        <div className="grid gap-4 md:grid-cols-[96px_1fr_220px] md:items-center">
                                            <div
                                                className={`${mono.className} inline-flex w-fit rounded-md border px-3 py-1 text-xs uppercase tracking-[0.14em]`}
                                                style={{ borderColor: "#AEC2E2", color: PALETTE.accent, background: PALETTE.accentSoft }}
                                            >
                                                step {step.step}
                                            </div>
                                            <div>
                                                <p className="text-lg font-semibold" style={{ color: PALETTE.text }}>{step.title}</p>
                                                <p className="mt-1 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                                    {step.action}
                                                </p>
                                            </div>
                                            <div className="rounded-md border px-3 py-2" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                                <p className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                                    output
                                                </p>
                                                <p className="mt-1 text-sm" style={{ color: PALETTE.text }}>{step.output}</p>
                                            </div>
                                        </div>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Outbound Core</SectionKicker>
                        <SectionHeading>Outbound B2B sem trabalho manual repetitivo.</SectionHeading>
                        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {coreBlocks.map((block, index) => (
                                <motion.div key={block.title} {...fadeUp(index * 0.06)}>
                                    <Panel className="h-full">
                                        <h3 className="text-xl font-semibold" style={{ color: PALETTE.text }}>{block.title}</h3>
                                        <p className="mt-2 text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                                            {block.text}
                                        </p>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="signal-engine" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Signal Engine</SectionKicker>
                        <SectionHeading>Camada acima do outbound, nao outro produto.</SectionHeading>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {signalLayers.map((layer, index) => (
                                <motion.div key={layer.id} {...fadeUp(index * 0.07)}>
                                    <Panel className="h-full">
                                        <p className={`${mono.className} text-xs uppercase tracking-[0.14em]`} style={{ color: PALETTE.accent }}>
                                            {layer.id}
                                        </p>
                                        <h3 className="mt-2 text-2xl font-semibold" style={{ color: PALETTE.text }}>{layer.title}</h3>
                                        <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                                            {layer.text}
                                        </p>
                                        <div className="mt-4 space-y-2">
                                            {layer.points.map((point) => (
                                                <div key={point} className="flex items-start gap-2">
                                                    <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.accent }} />
                                                    <p className="text-sm" style={{ color: PALETTE.text }}>{point}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Arquitetura</SectionKicker>
                        <SectionHeading>Como o valor acontece no fluxo.</SectionHeading>
                        <motion.div {...fadeUp()} className="mt-8">
                            <Panel>
                                <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
                                    {[
                                        {
                                            title: "Outbound Core",
                                            text: "Leads + campanhas + respostas + funil",
                                        },
                                        {
                                            title: "Signal Engine",
                                            text: "Eventos + padroes confiaveis",
                                        },
                                        {
                                            title: "Distribuicao",
                                            text: "Conteudo publico + autoridade + inbound",
                                        },
                                    ].map((item, index) => (
                                        <div key={item.title} className="relative rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                            <p className="text-lg font-semibold" style={{ color: PALETTE.text }}>{item.title}</p>
                                            <p className="mt-2 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>{item.text}</p>
                                            {index < 2 ? (
                                                <span className={`${mono.className} absolute -right-3 top-1/2 hidden -translate-y-1/2 rounded-full border px-2 py-1 text-[10px] md:block`} style={{ borderColor: "#AEC2E2", background: PALETTE.accentSoft, color: PALETTE.accent }}>
                                                    -&gt;
                                                </span>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        </motion.div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Exemplo Real</SectionKicker>
                        <div className="grid gap-4 md:grid-cols-3">
                            <motion.div {...fadeUp()}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>tweet</p>
                                    <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                        Analisando 427 mensagens outbound no Lastreia: SaaS B2B ate $99 responde 2.1x
                                        mais as quartas entre 9h e 11h.
                                    </p>
                                </Panel>
                            </motion.div>
                            <motion.div {...fadeUp(0.1)}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>grafico</p>
                                    <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                        Heatmap de reply rate por canal e horario mostra onde concentrar os proximos
                                        disparos.
                                    </p>
                                </Panel>
                            </motion.div>
                            <motion.div {...fadeUp(0.18)}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>micro-case</p>
                                    <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                        Apos ajustar CTA com base em dados, replies subiram 38% em 10 dias.
                                    </p>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Pra Quem E</SectionKicker>
                        <div className="grid gap-4 md:grid-cols-2">
                            <motion.div {...fadeUp()}>
                                <Panel>
                                    <h3 className="text-2xl font-semibold" style={{ color: PALETTE.text }}>Para quem e</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitYes.map((item) => (
                                            <div key={item} className="flex items-start gap-3">
                                                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.success }} />
                                                <p className="text-base" style={{ color: PALETTE.text }}>{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                            <motion.div {...fadeUp(0.08)}>
                                <Panel>
                                    <h3 className="text-2xl font-semibold" style={{ color: PALETTE.text }}>Nao e para</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitNo.map((item) => (
                                            <div key={item} className="flex items-start gap-3">
                                                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: "#9CA9B8" }} />
                                                <p className="text-base" style={{ color: PALETTE.muted }}>{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section id="cta-final" className="border-t px-6 py-24" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                    <div className="mx-auto max-w-4xl text-center">
                        <SectionKicker>CTA Final</SectionKicker>
                        <h2 className={`${heading.className} text-4xl font-extrabold tracking-tight md:text-6xl`} style={{ color: PALETTE.text }}>
                            Faca outbound. Ganhe sinais.
                        </h2>
                        <div className="mt-8">
                            <a
                                href="#"
                                className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md px-7 text-xs font-semibold uppercase tracking-[0.14em]`}
                                style={{ background: PALETTE.accent, color: "#F7FAFF" }}
                            >
                                Usar Lastreia como motor de outbound e distribuicao
                            </a>
                            <p className="mt-4 text-base" style={{ color: PALETTE.muted }}>
                                Outbound completo + Signal Engine. Sem post automatico. Sem achismo.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t px-6 py-10" style={{ borderColor: PALETTE.border, background: PALETTE.surface }}>
                <div className="mx-auto max-w-6xl">
                    <p className="text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                        Lastreia e um sistema de outbound que transforma atividade comercial em sinais publicos e
                        autoridade duradoura.
                    </p>
                    <p className={`${mono.className} mt-3 text-sm uppercase tracking-[0.14em]`} style={{ color: PALETTE.accent }}>
                        Outbound is the engine. Signals are the advantage.
                    </p>
                </div>
            </footer>
        </div>
    );
}

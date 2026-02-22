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
    bg: "#EEE8DE",
    bgAlt: "#E5DDD0",
    surface: "#FAF7F0",
    surfaceSoft: "#F2ECE2",
    border: "#CFC3AF",
    text: "#1E2A2A",
    muted: "#56615D",
    accent: "#0F7D6E",
    accentSoft: "#DCEFE9",
    success: "#1F4F8F",
};

const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.55, ease: "easeOut" as const, delay },
});

const summaryBlocks = [
    {
        title: "Outbound Core",
        text: "Você cria campanha, conversa com leads e acompanha o funil no mesmo lugar.",
    },
    {
        title: "Memória dos dados",
        text: "Cada reply, ignore e conversão fica salvo como dado útil para as próximas campanhas.",
    },
    {
        title: "Signal Engine",
        text: "O sistema encontra padrões e transforma isso em conteúdo claro para gerar autoridade.",
    },
];

const coreBlocks = [
    {
        title: "Lead sourcing",
        text: "Busca e organiza leads de múltiplas fontes.",
    },
    {
        title: "Enrichment automático",
        text: "Completa contexto antes do primeiro contato.",
    },
    {
        title: "Campanhas multicanal",
        text: "Email, LinkedIn e outros canais no mesmo fluxo.",
    },
    {
        title: "Central de respostas",
        text: "Todas as respostas em uma única caixa.",
    },
    {
        title: "Funil e métricas",
        text: "Pipeline e taxas reais para decidir o próximo passo.",
    },
];

const workflowSteps = [
    {
        step: "01",
        title: "Defina quem você quer abordar",
        action: "Escolha ICP, segmento e tipo de empresa.",
        result: "Lista inicial pronta.",
    },
    {
        step: "02",
        title: "Prepare os contatos",
        action: "Lastreia enriquece os dados para melhorar a abordagem.",
        result: "Mensagem com contexto.",
    },
    {
        step: "03",
        title: "Rode campanhas",
        action: "Dispare sequências multicanal sem operação manual repetitiva.",
        result: "Outbound ativo.",
    },
    {
        step: "04",
        title: "Capture o que aconteceu",
        action: "Replies, ignores, conversões, canal e horário viram eventos.",
        result: "Histórico estruturado.",
    },
    {
        step: "05",
        title: "Detecte padrões",
        action: "Signal Engine cruza os eventos e valida confiabilidade.",
        result: "Insights úteis.",
    },
    {
        step: "06",
        title: "Publique sinais",
        action: "Padrões válidos viram conteúdo pronto para distribuição.",
        result: "Autoridade e inbound.",
    },
];

const signalLayers = [
    {
        id: "Layer 01",
        title: "Event Capture",
        text: "Tudo que acontece no outbound vira evento imutável.",
        points: ["replies", "ignores", "conversões", "canal", "horário", "ICP"],
    },
    {
        id: "Layer 02",
        title: "Pattern Detector",
        text: "O sistema mostra padrões somente quando existe base confiável.",
        points: ["limite mínimo de 50% de confiabilidade", "contraste por período", "sem achismo"],
    },
    {
        id: "Layer 03",
        title: "Distribution Generator",
        text: "Cada padrão validado vira material pronto para publicar.",
        points: ["tweets", "threads", "gráficos exportáveis", "micro-cases"],
    },
];

const cycleSteps = [
    "Outbound no Lastreia",
    "Dados reais",
    "Padrões confiáveis",
    "Conteúdo público",
    "Autoridade",
    "Inbound",
    "Mais leads no Lastreia",
];

const faqItems = [
    {
        q: "Preciso entender estatística para usar?",
        a: "Não. O sistema já filtra e exibe só o que tem confiabilidade mínima.",
    },
    {
        q: "O sistema posta automaticamente por mim?",
        a: "Não. Você revisa, aprova e publica quando quiser.",
    },
    {
        q: "Signal Engine é outro produto?",
        a: "Não. Ele é uma camada acima do outbound que você já roda no Lastreia.",
    },
    {
        q: "Se eu parar de fazer outbound, ainda funciona?",
        a: "Menos. O motor de dados vem da operação de outbound ativa.",
    },
];

const fitYes = [
    "founders técnicos que vendem",
    "SaaS B2B early-stage",
    "times pequenos que fazem outbound de verdade",
    "quem quer crescer sem virar guru",
];

const fitNo = ["spam disfarçado", "marketplace de leads", "post automático sem contexto", "promessas mágicas"];

function SectionKicker({ children }: { children: ReactNode }) {
    return (
        <p className={`${mono.className} mb-4 text-xs uppercase tracking-[0.16em]`} style={{ color: PALETTE.muted }}>
            {children}
        </p>
    );
}

function SectionTitle({ children }: { children: ReactNode }) {
    return (
        <h2 className={`${heading.className} max-w-4xl text-3xl font-bold tracking-tight leading-[1.12] md:text-5xl md:leading-[1.08]`} style={{ color: PALETTE.text }}>
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
                boxShadow: "0 10px 22px rgba(24,34,53,0.05)",
            }}
        >
            {children}
        </div>
    );
}

function DotItem({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.success }} />
            <p className="text-base leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>
                {children}
            </p>
        </div>
    );
}

export default function LandingV5() {
    return (
        <div className={`${heading.className} min-h-screen`} style={{ background: PALETTE.bg }}>
            <div
                className="pointer-events-none fixed inset-0 opacity-80"
                style={{
                    background:
                        "radial-gradient(circle at 8% 10%, rgba(31,79,143,0.07) 0, transparent 35%), radial-gradient(circle at 92% 18%, rgba(15,125,110,0.08) 0, transparent 32%)",
                }}
            />

            <header
                className="fixed top-0 z-50 w-full border-b"
                style={{
                    background: "rgba(238,232,222,0.93)",
                    borderColor: PALETTE.border,
                    backdropFilter: "blur(8px)",
                }}
            >
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: PALETTE.text }}>Lastreia</span>
                        <span
                            className={`${mono.className} rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]`}
                            style={{ color: PALETTE.accent, background: PALETTE.accentSoft, borderColor: "#AFC1DE" }}
                        >
                            outbound + signal engine
                        </span>
                    </div>
                    <nav className="hidden items-center gap-6 md:flex">
                        {[
                            ["#o-que-faz", "Mudança"],
                            ["#como-funciona", "Como funciona"],
                            ["#por-que-agora", "Agora"],
                            ["#faq", "FAQ"],
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
                        <motion.div {...reveal()}>
                            <SectionKicker>Visão Geral</SectionKicker>
                            <h1 className={`${heading.className} max-w-4xl text-4xl font-extrabold tracking-tight leading-[1.08] md:text-6xl md:leading-[1.04]`} style={{ color: PALETTE.text }}>
                                Outbound completo com memória.
                                <span className="block">Você vende hoje, aprende com dados reais e transforma isso em autoridade amanhã.</span>
                            </h1>
                            <p className="mt-6 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.muted }}>
                                Lastreia faz o trabalho de outbound de ponta a ponta.
                                <br className="hidden md:block" />
                                Reaproveita os dados da operação para gerar sinais públicos com números reais, que
                                fortalecem sua autoridade.
                            </p>
                            <p className="mt-4 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.text }}>
                                Se você faz outbound e constrói em público, o Lastreia transforma sua operação
                                comercial em sinais que você pode publicar com confiança.
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
                                    Ver como o outbound vira sinal
                                </a>
                            </div>
                        </motion.div>

                        <motion.div {...reveal(0.1)}>
                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.14em]`} style={{ color: PALETTE.muted }}>
                                    Entenda em 1 minuto
                                </p>
                                <div className="mt-5 space-y-4">
                                    {summaryBlocks.map((block) => (
                                        <div key={block.title} className="rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                            <p className="text-base font-semibold" style={{ color: PALETTE.text }}>{block.title}</p>
                                            <p className="mt-1 text-base leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>
                                                {block.text}
                                            </p>
                                        </div>
                                    ))}
                                    <div className="rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                        <p className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.accent }}>
                                            Prova técnica
                                        </p>
                                        <p className="mt-1 text-base leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>
                                            Desenvolvido a partir de milhares de interações outbound analisadas em produção.
                                        </p>
                                    </div>
                                </div>
                            </Panel>
                        </motion.div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Problema</SectionKicker>
                        <SectionTitle>Outbound funciona. O problema é desperdiçar o aprendizado.</SectionTitle>
                        <p className="mt-5 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.muted }}>
                            Normalmente a empresa envia mensagem, recebe resposta, fecha algumas vendas e para aí.
                            O aprendizado fica preso no CRM e a próxima campanha quase sempre recomeça do zero.
                        </p>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {[
                                "você posta opinião quando já tem dados",
                                "marketing vira achismo, não consequência do que você vende",
                                "cada campanha começa como se fosse a primeira",
                            ].map((item, index) => (
                                <motion.div key={item} {...reveal(index * 0.07)}>
                                    <Panel>
                                        <p className="text-base leading-relaxed" style={{ color: PALETTE.text }}>{item}</p>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="o-que-faz" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>O que muda quando você fecha o ciclo</SectionKicker>
                        <SectionTitle>Fica simples quando você separa em 3 partes.</SectionTitle>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {[
                                {
                                    title: "1) Roda outbound",
                                    text: "Lastreia ajuda a prospectar, disparar, responder e acompanhar funil.",
                                },
                                {
                                    title: "2) Organiza os dados",
                                    text: "Cada interação comercial vira dado estruturado no histórico da conta.",
                                },
                                {
                                    title: "3) Gera sinais",
                                    text: "Padrões válidos viram conteúdo para distribuição e autoridade.",
                                },
                            ].map((item, index) => (
                                <motion.div key={item.title} {...reveal(index * 0.08)}>
                                    <Panel className="h-full">
                                        <h3 className="text-xl font-semibold" style={{ color: PALETTE.text }}>{item.title}</h3>
                                        <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                                            {item.text}
                                        </p>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="como-funciona" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Como Funciona na Prática</SectionKicker>
                        <SectionTitle>Do primeiro lead à distribuição, em 6 passos.</SectionTitle>
                        <p className="mt-5 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.muted }}>
                            Você já faz outbound.
                            <br className="hidden md:block" />
                            O Lastreia só garante que nada do que acontece ali seja desperdiçado.
                        </p>
                        <div className="mt-8 space-y-3">
                            {workflowSteps.map((step, index) => (
                                <motion.div key={step.step} {...reveal(index * 0.05)}>
                                    <Panel className="!p-5 md:!p-6">
                                        <div className="grid gap-4 md:grid-cols-[90px_1fr_210px] md:items-center">
                                            <div
                                                className={`${mono.className} inline-flex w-fit rounded-md border px-3 py-1 text-xs uppercase tracking-[0.14em]`}
                                                style={{ borderColor: "#AFC1DE", color: PALETTE.accent, background: PALETTE.accentSoft }}
                                            >
                                                step {step.step}
                                            </div>
                                            <div>
                                                <p className="text-lg font-semibold" style={{ color: PALETTE.text }}>{step.title}</p>
                                                <p className="mt-1 text-base leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>
                                                    {step.action}
                                                </p>
                                            </div>
                                            <div className="rounded-md border px-3 py-2" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                                <p className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                                    resultado
                                                </p>
                                                <p className="mt-1 text-base" style={{ color: PALETTE.text }}>{step.result}</p>
                                            </div>
                                        </div>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Outbound Core</SectionKicker>
                        <SectionTitle>O que já vem pronto para rodar outbound.</SectionTitle>
                        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {coreBlocks.map((block, index) => (
                                <motion.div key={block.title} {...reveal(index * 0.06)}>
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

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Signal Engine</SectionKicker>
                        <SectionTitle>A camada que transforma operação diária em vantagem acumulada.</SectionTitle>
                        <p className="mt-5 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.muted }}>
                            Não é uma ferramenta separada.
                            <br className="hidden md:block" />
                            É a camada que usa os dados do seu outbound para mostrar o que realmente funciona e gerar
                            material de distribuição.
                        </p>
                        <div className="mt-5 max-w-3xl rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                            <p className="text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                Código é copiável.
                                <br />
                                Histórico operacional não.
                            </p>
                            <p className="mt-2 text-sm leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>
                                O Lastreia acumula memória comercial proprietária da sua operação.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {signalLayers.map((layer, index) => (
                                <motion.div key={layer.id} {...reveal(index * 0.07)}>
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
                                                <DotItem key={point}>{point}</DotItem>
                                            ))}
                                        </div>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Exemplos Reais</SectionKicker>
                        <div className="grid gap-4 md:grid-cols-3">
                            <motion.div {...reveal()}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                        Exemplo 1 - Tweet
                                    </p>
                                    <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                        Analisando 427 mensagens outbound:
                                        <br />
                                        SaaS B2B até $99 responde 2.1x mais
                                        <br />
                                        às quartas, entre 9h-11h.
                                    </p>
                                </Panel>
                            </motion.div>
                            <motion.div {...reveal(0.1)}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                        Exemplo 2 - Grafico
                                    </p>
                                    <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                        Heatmap de reply rate por canal e horário para escolher o melhor momento de
                                        disparo.
                                    </p>
                                </Panel>
                            </motion.div>
                            <motion.div {...reveal(0.18)}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                        Exemplo 3 - Micro-case
                                    </p>
                                    <p className="mt-3 text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                        Depois de ajustar CTA com base nos dados do outbound, replies subiram 38% em
                                        10 dias.
                                    </p>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Ciclo Completo</SectionKicker>
                        <SectionTitle>O valor cresce a cada nova campanha.</SectionTitle>
                        <div className="mt-8 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                            <motion.div {...reveal()}>
                                <Panel>
                                    <div className="space-y-3">
                                        {cycleSteps.map((step, index) => (
                                            <div key={step} className="flex items-center gap-3">
                                                <span className={`${mono.className} text-xs`} style={{ color: PALETTE.muted }}>
                                                    {String(index + 1).padStart(2, "0")}
                                                </span>
                                                <span className="text-base" style={{ color: PALETTE.text }}>{step}</span>
                                                {index < cycleSteps.length - 1 ? (
                                                    <span className={`${mono.className} text-xs`} style={{ color: PALETTE.muted }}>v</span>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                            <motion.div {...reveal(0.1)}>
                                <Panel>
                                    <p className="text-lg leading-relaxed" style={{ color: PALETTE.text }}>
                                        Quem copia outbound copia ferramenta.
                                        <br />
                                        Quem copia signals precisa de meses de dados reais.
                                    </p>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section id="por-que-agora" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Por que isso importa agora</SectionKicker>
                        <SectionTitle>A maioria já faz outbound. Quase ninguém transforma isso em autoridade.</SectionTitle>
                        <motion.div {...reveal()} className="mt-8 grid gap-4 md:grid-cols-3">
                            <Panel className="h-full">
                                <p className="text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                    Quase todo time comercial já envia campanhas de outbound todos os dias.
                                </p>
                            </Panel>
                            <Panel className="h-full">
                                <p className="text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                    Poucos times convertem esse aprendizado em sinais públicos com consistência.
                                </p>
                            </Panel>
                            <Panel className="h-full">
                                <p className="text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                    Quem começa agora acumula dados antes e publica melhor depois.
                                </p>
                            </Panel>
                        </motion.div>
                    </div>
                </section>

                <section id="faq" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>FAQ Rápido</SectionKicker>
                        <SectionTitle>Perguntas que ajudam a entender sem jargão.</SectionTitle>
                        <div className="mt-8 space-y-3">
                            {faqItems.map((item, index) => (
                                <motion.div key={item.q} {...reveal(index * 0.06)}>
                                    <Panel className="!p-5 md:!p-6">
                                        <p className="text-lg font-semibold" style={{ color: PALETTE.text }}>{item.q}</p>
                                        <p className="mt-2 text-base leading-relaxed" style={{ color: PALETTE.muted }}>{item.a}</p>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Pra Quem É</SectionKicker>
                        <div className="grid gap-4 md:grid-cols-2">
                            <motion.div {...reveal()}>
                                <Panel>
                                    <h3 className="text-2xl font-semibold" style={{ color: PALETTE.text }}>Para quem é</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitYes.map((item) => (
                                            <DotItem key={item}>{item}</DotItem>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                            <motion.div {...reveal(0.08)}>
                                <Panel>
                                    <h3 className="text-2xl font-semibold" style={{ color: PALETTE.text }}>Não é para</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitNo.map((item) => (
                                            <div key={item} className="flex items-start gap-3">
                                                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: "#9CA8B8" }} />
                                                <p className="text-base leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>{item}</p>
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
                            Faça outbound. Ganhe sinais.
                        </h2>
                        <p className="mt-4 text-lg leading-relaxed" style={{ color: PALETTE.text }}>
                            Outbound gera receita.
                            <br />
                            Memória gera vantagem.
                        </p>
                        <div className="mt-8">
                            <a
                                href="#"
                                className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md px-7 text-xs font-semibold uppercase tracking-[0.14em]`}
                                style={{ background: PALETTE.accent, color: "#F7FAFF" }}
                            >
                                Usar Lastreia como motor de outbound e distribuição
                            </a>
                            <p className="mt-4 text-base" style={{ color: PALETTE.muted }}>
                                Outbound completo + Signal Engine. Sem post automático. Sem achismo.
                            </p>
                            <div className="mx-auto mt-6 max-w-xl rounded-xl border p-4 text-left" style={{ borderColor: PALETTE.border, background: PALETTE.surface }}>
                                <p className="text-sm leading-relaxed" style={{ color: PALETTE.text }}>
                                    Nenhum post é publicado automaticamente.
                                </p>
                                <p className="text-sm leading-relaxed" style={{ color: PALETTE.text }}>
                                    Nenhum dado é exposto sem sua aprovação.
                                </p>
                            </div>
                            <p className="mt-4 text-sm" style={{ color: PALETTE.muted }}>
                                Construído por founders que fazem outbound todos os dias.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t px-6 py-10" style={{ borderColor: PALETTE.border, background: PALETTE.surface }}>
                <div className="mx-auto max-w-6xl">
                    <p className="text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                        Lastreia é um sistema de outbound que transforma atividade comercial em sinais públicos e
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

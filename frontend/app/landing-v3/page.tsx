"use client";

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

const COLORS = {
    bg: "#EEF3EE",
    bgAlt: "#E5EDE6",
    surface: "#F8FBF7",
    surfaceSoft: "#F2F7F3",
    border: "#C6D3CA",
    text: "#15221C",
    muted: "#4E5E56",
    accent: "#0C7A68",
    accentSoft: "#DCEFE8",
    danger: "#B05353",
};

const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.55, ease: "easeOut" as const, delay },
});

const outboundCoreBlocks = [
    {
        title: "Lead sourcing",
        text: "Encontre e organize leads de multiplas fontes.",
    },
    {
        title: "Enrichment automatico",
        text: "Contexto real antes do primeiro contato.",
    },
    {
        title: "Campanhas multicanal",
        text: "Email, LinkedIn e outros canais.",
    },
    {
        title: "Central de respostas",
        text: "Tudo em um so lugar.",
    },
    {
        title: "Funil e metricas reais",
        text: "Veja o que funciona de verdade.",
    },
];

const signalEvents = ["replies", "ignores", "conversoes", "canais", "horarios", "ICPs"];

const layerBlocks = [
    {
        id: "01",
        title: "Event Capture",
        text: "Tudo que acontece no outbound vira evento imutavel. Sem setup extra.",
        points: ["eventos versionados", "timeline por conta", "zero setup extra"],
    },
    {
        id: "02",
        title: "Pattern Detector",
        text: "O sistema cruza eventos e detecta padroes com confianca estatistica.",
        points: ["insights acima de 50% de confiabilidade", "base amostral", "sem achismo e sem hype"],
    },
    {
        id: "03",
        title: "Distribution Generator",
        text: "Cada padrao vira conteudo pronto para publicar.",
        points: ["tweets", "threads", "graficos exportaveis", "micro-cases"],
    },
];

const cycleSteps = [
    "Outbound no Leadflow",
    "Dados reais",
    "Padroes confiaveis",
    "Conteudo publico",
    "Autoridade",
    "Inbound",
    "Mais leads no Leadflow",
];

const fitYes = [
    "founders tecnicos",
    "SaaS B2B",
    "times pequenos de outbound",
    "quem quer vender sem virar guru",
];

const fitNo = ["spam", "lead marketplace", "post automatico", "promessas magicas"];

const channels = ["Email", "LinkedIn", "WhatsApp"];
const hours = ["08h", "10h", "12h", "14h"];
const heatmapValues = [
    [21, 28, 24, 19],
    [26, 39, 31, 22],
    [19, 33, 27, 20],
];

function heatColor(value: number) {
    if (value >= 35) return "#0C7A68";
    if (value >= 30) return "#1D9C88";
    if (value >= 24) return "#7CC9BA";
    return "#DCEFE8";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className={`${mono.className} mb-4 text-xs uppercase tracking-[0.18em]`} style={{ color: COLORS.muted }}>
            {children}
        </p>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2 className={`${heading.className} text-3xl font-bold tracking-tight md:text-5xl md:leading-[1.08]`} style={{ color: COLORS.text }}>
            {children}
        </h2>
    );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`rounded-2xl border p-6 md:p-7 ${className}`}
            style={{ background: COLORS.surface, borderColor: COLORS.border, boxShadow: "0 8px 20px rgba(21,34,28,0.05)" }}
        >
            {children}
        </div>
    );
}

export default function LandingV3() {
    return (
        <div className={`${heading.className} min-h-screen`} style={{ background: COLORS.bg }}>
            <div
                className="pointer-events-none fixed inset-0 opacity-80"
                style={{
                    background:
                        "radial-gradient(circle at 8% 10%, rgba(12,122,104,0.08) 0, transparent 32%), radial-gradient(circle at 88% 18%, rgba(12,122,104,0.06) 0, transparent 30%)",
                }}
            />

            <header
                className="fixed top-0 z-50 w-full border-b"
                style={{ background: "rgba(238,243,238,0.93)", borderColor: COLORS.border, backdropFilter: "blur(8px)" }}
            >
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: COLORS.text }}>Leadflow</span>
                        <span
                            className={`${mono.className} rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-[0.14em]`}
                            style={{ color: COLORS.accent, background: COLORS.accentSoft, borderColor: "#A7CEC4" }}
                        >
                            outbound + signal engine
                        </span>
                    </div>
                    <a
                        href="#cta-final"
                        className={`${mono.className} text-xs uppercase tracking-[0.14em]`}
                        style={{ color: COLORS.accent }}
                    >
                        Ativar
                    </a>
                </div>
            </header>

            <main className="relative z-10 pt-14">
                <section className="min-h-[90vh] px-6 py-20 flex items-center">
                    <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[1.12fr_0.88fr] md:items-center">
                        <motion.div {...reveal()}>
                            <SectionLabel>01 Hero</SectionLabel>
                            <h1 className={`${heading.className} max-w-4xl text-4xl font-extrabold tracking-tight md:text-6xl md:leading-[1.04]`} style={{ color: COLORS.text }}>
                                Outbound que gera clientes e sinais publicos automaticamente.
                            </h1>
                            <p className="mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: COLORS.muted }}>
                                Leadflow executa seu outbound B2B de ponta a ponta e transforma cada reply, ignore e
                                conversao em sinais reais que constroem autoridade e trazem inbound.
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <a
                                    href="#cta-final"
                                    className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md px-6 text-xs font-semibold uppercase tracking-[0.14em]`}
                                    style={{ background: COLORS.accent, color: "#F6FFFC" }}
                                >
                                    Ativar outbound inteligente
                                </a>
                                <a
                                    href="#como-funciona"
                                    className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md border px-6 text-xs uppercase tracking-[0.14em]`}
                                    style={{ borderColor: COLORS.border, color: COLORS.muted, background: COLORS.surface }}
                                >
                                    Ver como o outbound vira sinal
                                </a>
                            </div>
                        </motion.div>

                        <motion.div {...reveal(0.1)}>
                            <Card>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.14em]`} style={{ color: COLORS.muted }}>
                                    Arquitetura simples
                                </p>
                                <div className="mt-5 space-y-3">
                                    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "#9FC2B9", background: COLORS.surfaceSoft }}>
                                        <p className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: COLORS.accent }}>
                                            Outbound Core
                                        </p>
                                        <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.muted }}>
                                            lead sourcing, enrichment, campanhas, respostas e funil.
                                        </p>
                                    </div>
                                    <div className="flex justify-center">
                                        <span className={`${mono.className} text-xs`} style={{ color: "#83968D" }}>v</span>
                                    </div>
                                    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "#9FC2B9", background: COLORS.surfaceSoft }}>
                                        <p className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: COLORS.accent }}>
                                            Signal Engine
                                        </p>
                                        <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.muted }}>
                                            captura eventos, detecta padroes e gera distribuicao.
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: COLORS.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionLabel>02 Problema</SectionLabel>
                        <SectionTitle>Outbound funciona. O problema e que ele morre no privado.</SectionTitle>
                        <p className="mt-5 max-w-3xl text-lg leading-relaxed" style={{ color: COLORS.muted }}>
                            Voce envia mensagens, testa abordagens, ajusta timing, fecha conversoes mas todo esse
                            aprendizado fica preso no CRM.
                        </p>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {[
                                "voce continua sem autoridade publica",
                                "cada campanha comeca do zero",
                                "seu marketing vira opiniao, nao dado",
                            ].map((item, index) => (
                                <motion.div key={item} {...reveal(index * 0.07)}>
                                    <Card>
                                        <div className="flex items-start gap-3">
                                            <span className={`${mono.className} text-sm`} style={{ color: COLORS.danger }}>x</span>
                                            <p className="text-base leading-relaxed" style={{ color: COLORS.text }}>{item}</p>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: COLORS.border, background: COLORS.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionLabel>03 Proposta Unica</SectionLabel>
                        <SectionTitle>Leadflow nao substitui outbound. Ele fecha o ciclo.</SectionTitle>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {[
                                ["outbound", "motor"],
                                ["dados", "combustivel"],
                                ["sinais", "output"],
                            ].map(([left, right], index) => (
                                <motion.div key={left} {...reveal(index * 0.08)}>
                                    <Card>
                                        <p className={`${mono.className} text-xs uppercase tracking-[0.14em]`} style={{ color: COLORS.muted }}>
                                            no Leadflow
                                        </p>
                                        <p className="mt-3 text-lg" style={{ color: COLORS.text }}>
                                            <span style={{ color: COLORS.accent }}>{left}</span> e o {right}
                                        </p>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>

                        <p className="mt-6 max-w-3xl text-lg leading-relaxed" style={{ color: COLORS.muted }}>
                            Cada interacao comercial vira aprendizado reutilizavel dentro e fora da plataforma.
                        </p>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: COLORS.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionLabel>04 Outbound Core</SectionLabel>
                        <SectionTitle>Outbound B2B, sem trabalho manual.</SectionTitle>
                        <div
                            className="mt-5 inline-flex rounded-md border px-3 py-2"
                            style={{ borderColor: "#9FC2B9", background: COLORS.accentSoft }}
                        >
                            <span className={`${mono.className} text-xs uppercase tracking-[0.14em]`} style={{ color: COLORS.accent }}>
                                Tudo isso ja existe no Leadflow
                            </span>
                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {outboundCoreBlocks.map((block, index) => (
                                <motion.div key={block.title} {...reveal(index * 0.06)}>
                                    <Card className="h-full">
                                        <h3 className="text-xl font-semibold" style={{ color: COLORS.text }}>{block.title}</h3>
                                        <p className="mt-2 text-base leading-relaxed" style={{ color: COLORS.muted }}>
                                            {block.text}
                                        </p>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: COLORS.border, background: COLORS.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionLabel>05 Signal Engine</SectionLabel>
                        <SectionTitle>O diferencial: seu outbound vira distribuicao.</SectionTitle>
                        <p className="mt-5 max-w-3xl text-lg leading-relaxed" style={{ color: COLORS.muted }}>
                            O Leadflow captura tudo que acontece no outbound como eventos tipados. Esses eventos
                            alimentam o Signal Engine.
                        </p>

                        <div className="mt-8 grid gap-2 sm:grid-cols-3 md:grid-cols-6">
                            {signalEvents.map((item) => (
                                <div
                                    key={item}
                                    className="rounded-md border px-3 py-2 text-center"
                                    style={{ borderColor: "#9FC2B9", background: COLORS.surfaceSoft }}
                                >
                                    <span className={`${mono.className} text-xs uppercase tracking-[0.1em]`} style={{ color: COLORS.accent }}>
                                        {item}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="como-funciona" className="border-t px-6 py-20" style={{ borderColor: COLORS.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionLabel>06 As 3 Camadas</SectionLabel>
                        <div className="grid gap-4 md:grid-cols-3">
                            {layerBlocks.map((layer, index) => (
                                <motion.div key={layer.id} {...reveal(index * 0.07)}>
                                    <Card className="h-full">
                                        <p className={`${mono.className} text-xs uppercase tracking-[0.14em]`} style={{ color: COLORS.accent }}>
                                            {layer.id}
                                        </p>
                                        <h3 className="mt-2 text-2xl font-semibold" style={{ color: COLORS.text }}>{layer.title}</h3>
                                        <p className="mt-3 text-base leading-relaxed" style={{ color: COLORS.muted }}>
                                            {layer.text}
                                        </p>
                                        <div className="mt-4 space-y-2">
                                            {layer.points.map((point) => (
                                                <div key={point} className="flex items-start gap-2">
                                                    <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: COLORS.accent }} />
                                                    <p className="text-sm leading-relaxed" style={{ color: COLORS.text }}>{point}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {layer.id === "03" ? (
                                            <p className="mt-4 text-sm" style={{ color: COLORS.muted }}>
                                                Voce revisa. Voce aprova. Voce publica.
                                            </p>
                                        ) : null}
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: COLORS.border, background: COLORS.bgAlt }}>
                    <div className="mx-auto max-w-6xl" id="exemplos">
                        <SectionLabel>07 Exemplos Reais</SectionLabel>
                        <div className="grid gap-4 md:grid-cols-3">
                            <motion.div {...reveal()}>
                                <Card className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: COLORS.muted }}>
                                        Exemplo 1 - Tweet
                                    </p>
                                    <p className="mt-4 text-base leading-relaxed" style={{ color: COLORS.text }}>
                                        Analisando 427 mensagens outbound no Leadflow: SaaS B2B com ticket ate 99 dolares
                                        respondem 2.1x mais as quartas entre 9h e 11h.
                                    </p>
                                </Card>
                            </motion.div>

                            <motion.div {...reveal(0.08)}>
                                <Card className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: COLORS.muted }}>
                                        Exemplo 2 - Grafico
                                    </p>
                                    <p className="mt-3 text-sm" style={{ color: COLORS.muted }}>
                                        Heatmap de reply rate por canal e horario
                                    </p>
                                    <div className="mt-4 overflow-hidden rounded-md border" style={{ borderColor: COLORS.border }}>
                                        <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-[1px]" style={{ background: COLORS.border }}>
                                            <div style={{ background: COLORS.surface }} className="px-2 py-1" />
                                            {hours.map((hour) => (
                                                <div
                                                    key={hour}
                                                    className={`${mono.className} px-2 py-1 text-center text-[11px]`}
                                                    style={{ background: COLORS.surface, color: COLORS.muted }}
                                                >
                                                    {hour}
                                                </div>
                                            ))}
                                            {channels.map((channel, channelIndex) => (
                                                <div key={channel} className="contents">
                                                    <div
                                                        className={`${mono.className} px-2 py-2 text-[11px]`}
                                                        style={{ background: COLORS.surface, color: COLORS.muted }}
                                                    >
                                                        {channel}
                                                    </div>
                                                    {heatmapValues[channelIndex].map((value, hourIndex) => (
                                                        <div
                                                            key={`${channel}-${hours[hourIndex]}`}
                                                            className={`${mono.className} flex h-10 items-center justify-center text-[11px]`}
                                                            style={{
                                                                background: heatColor(value),
                                                                color: value >= 30 ? "#F4FFFC" : COLORS.text,
                                                            }}
                                                        >
                                                            {value}%
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>

                            <motion.div {...reveal(0.15)}>
                                <Card className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: COLORS.muted }}>
                                        Exemplo 3 - Micro-case
                                    </p>
                                    <p className="mt-4 text-base leading-relaxed" style={{ color: COLORS.text }}>
                                        Apos ajustar CTA com base nos dados do outbound, aumentamos replies em 38% em
                                        10 dias.
                                    </p>
                                </Card>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: COLORS.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionLabel>08 Ciclo Completo</SectionLabel>
                        <SectionTitle>Outbound nao termina na conversao. Ele comeca nela.</SectionTitle>

                        <div className="mt-8 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                            <motion.div {...reveal()}>
                                <Card>
                                    <div className="space-y-3">
                                        {cycleSteps.map((step, index) => (
                                            <div key={step} className="flex items-center gap-3">
                                                <span className={`${mono.className} text-xs`} style={{ color: COLORS.muted }}>
                                                    {String(index + 1).padStart(2, "0")}
                                                </span>
                                                <span className="text-base" style={{ color: COLORS.text }}>{step}</span>
                                                {index < cycleSteps.length - 1 ? (
                                                    <span className={`${mono.className} text-xs`} style={{ color: COLORS.muted }}>v</span>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>

                            <motion.div {...reveal(0.1)}>
                                <Card>
                                    <p className="text-lg leading-relaxed" style={{ color: COLORS.text }}>
                                        Quem copia outbound copia ferramenta.
                                        <br />
                                        Quem copia signals precisa de tempo.
                                    </p>
                                </Card>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section className="border-t px-6 py-20" style={{ borderColor: COLORS.border, background: COLORS.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionLabel>09 Pra Quem E</SectionLabel>
                        <div className="grid gap-4 md:grid-cols-2">
                            <motion.div {...reveal()}>
                                <Card>
                                    <h3 className="text-2xl font-semibold" style={{ color: COLORS.text }}>Para quem e</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitYes.map((item) => (
                                            <div key={item} className="flex items-start gap-3">
                                                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: COLORS.accent }} />
                                                <p className="text-base" style={{ color: COLORS.text }}>{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>

                            <motion.div {...reveal(0.08)}>
                                <Card>
                                    <h3 className="text-2xl font-semibold" style={{ color: COLORS.text }}>Nao e para</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitNo.map((item) => (
                                            <div key={item} className="flex items-start gap-3">
                                                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: "#9DAFA7" }} />
                                                <p className="text-base" style={{ color: COLORS.muted }}>{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section id="cta-final" className="border-t px-6 py-24" style={{ borderColor: COLORS.border }}>
                    <div className="mx-auto max-w-4xl text-center">
                        <SectionLabel>10 CTA Final</SectionLabel>
                        <h2 className={`${heading.className} text-4xl font-extrabold tracking-tight md:text-6xl`} style={{ color: COLORS.text }}>
                            Faca outbound. Ganhe sinais.
                        </h2>
                        <div className="mt-8">
                            <a
                                href="#"
                                className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md px-7 text-xs font-semibold uppercase tracking-[0.14em]`}
                                style={{ background: COLORS.accent, color: "#F6FFFC" }}
                            >
                                Usar Leadflow como motor de outbound e distribuicao
                            </a>
                            <p className="mt-4 text-base" style={{ color: COLORS.muted }}>
                                Outbound completo + Signal Engine. Sem post automatico. Sem achismo.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t px-6 py-10" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
                <div className="mx-auto max-w-6xl">
                    <p className="text-base leading-relaxed" style={{ color: COLORS.muted }}>
                        Leadflow e um sistema de outbound que transforma atividade comercial em sinais publicos e
                        autoridade duradoura.
                    </p>
                    <p className={`${mono.className} mt-3 text-sm uppercase tracking-[0.14em]`} style={{ color: COLORS.accent }}>
                        Outbound is the engine. Signals are the advantage.
                    </p>
                </div>
            </footer>
        </div>
    );
}

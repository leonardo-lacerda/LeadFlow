"use client";

import { useState, type ReactNode } from "react";
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
    "Outbound no Leadflow",
    "Dados reais",
    "Padrões confiáveis",
    "Conteúdo público",
    "Autoridade",
    "Inbound",
    "Mais leads no Leadflow",
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
        a: "Não. Ele é uma camada acima do outbound que você já roda no Leadflow.",
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

type HeroProfileId = "daily" | "inconsistent" | "not-yet";
type SimulationIcp = "SaaS B2B" | "Agencia" | "Outro";
type SimulationChannel = "Email" | "LinkedIn";
type SimulationGoal = "Conversa" | "Demo";
type ProgressKey = "connect" | "campaign" | "signal";

type SimulationResult = {
    sample: number;
    replies: number;
    ignores: number;
    conversions: number;
    channel: SimulationChannel;
    bestWindow: string;
    confidence: number;
    signal: string;
};

const heroChoices: { id: HeroProfileId; label: string; reflection: string }[] = [
    {
        id: "daily",
        label: "Sim, todo dia",
        reflection: "Então você já está gerando dados - só não está usando tudo isso a seu favor.",
    },
    {
        id: "inconsistent",
        label: "Sim, mas sem consistência",
        reflection: "Você já faz outbound, mas está perdendo aprendizado em cada campanha.",
    },
    {
        id: "not-yet",
        label: "Ainda não",
        reflection: "Quando começar, o Leadflow garante que nada do processo se perca.",
    },
];

const diagnosisOptions = [
    {
        id: "spread",
        label: "As respostas dos leads ficam espalhadas entre CRM, inbox e planilhas.",
    },
    {
        id: "restart",
        label: "Toda campanha nova parece um recomeço do zero.",
    },
    {
        id: "guessing",
        label: "O time decide copy e horario mais no feeling do que em dados.",
    },
    {
        id: "disconnect",
        label: "Marketing publica sem usar o que o comercial aprendeu.",
    },
    {
        id: "noreuse",
        label: "Depois da campanha, quase nada vira aprendizado reutilizavel.",
    },
];

const progressSteps: { key: ProgressKey; title: string; helper: string }[] = [
    {
        key: "connect",
        title: "Passo 1: Conectar outbound",
        helper: "Conecte sua operação para capturar eventos reais.",
    },
    {
        key: "campaign",
        title: "Passo 2: Rodar primeira campanha",
        helper: "Dispare e centralize respostas em um único fluxo.",
    },
    {
        key: "signal",
        title: "Passo 3: Gerar primeiro sinal",
        helper: "Transforme aprendizado em conteúdo publicável.",
    },
];

function buildSimulation(icp: SimulationIcp, channel: SimulationChannel, goal: SimulationGoal): SimulationResult {
    const baseByIcp: Record<SimulationIcp, number> = {
        "SaaS B2B": 764,
        Agencia: 588,
        Outro: 436,
    };

    const confidenceBase: Record<SimulationIcp, number> = {
        "SaaS B2B": 68,
        Agencia: 62,
        Outro: 57,
    };

    const channelFactor = channel === "LinkedIn" ? 0.82 : 1;
    const goalFactor = goal === "Demo" ? 1.05 : 1;

    const sample = Math.round(baseByIcp[icp] * channelFactor);
    const replyRateBase = channel === "Email" ? 0.19 : 0.15;
    const replyRate = goal === "Demo" ? replyRateBase * 0.9 : replyRateBase;
    const replies = Math.max(24, Math.round(sample * replyRate * goalFactor));
    const ignores = Math.max(40, sample - replies);
    const conversionRate = goal === "Demo" ? 0.13 : 0.07;
    const conversions = Math.max(5, Math.round(replies * conversionRate));
    const bestWindow = channel === "Email" ? "Qua, 9h-11h" : "Ter, 10h-12h";
    const confidence = Math.max(
        45,
        Math.min(
            89,
            confidenceBase[icp] + (channel === "Email" ? 0 : -4) + (goal === "Demo" ? 3 : 0)
        )
    );

    const signal =
        `Analisando ${sample} mensagens outbound: ` +
        `${icp} responde melhor em ${channel} na janela ${bestWindow}.`;

    return {
        sample,
        replies,
        ignores,
        conversions,
        channel,
        bestWindow,
        confidence,
        signal,
    };
}

function getConfidenceState(value: number) {
    if (value < 50) {
        return {
            label: "Pode ser ruído",
            helper: "Ainda é cedo para publicar. Vale coletar mais dados.",
        };
    }

    if (value < 80) {
        return {
            label: "Padrão emergente",
            helper: "Já é um sinal útil para guiar a próxima campanha.",
        };
    }

    return {
        label: "Publicável com segurança",
        helper: "Já tem confiança para virar conteúdo público.",
    };
}

function generateSignal(segment: string, price: string, channel: string) {
    const parsedPrice = Number(price);
    const safePrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? Math.round(parsedPrice) : 99;

    const baseBySegment: Record<string, number> = {
        "SaaS B2B": 427,
        Agencia: 312,
        Ecommerce: 286,
        Outro: 244,
    };

    const base = baseBySegment[segment] ?? 244;
    const multiplier = channel === "Email" ? "2.1x" : channel === "LinkedIn" ? "1.8x" : "1.6x";
    const window = channel === "Email" ? "às quartas, entre 9h-11h" : "às terças, entre 10h-12h";

    return `Analisando ${base} mensagens outbound: ${segment} com ticket até $${safePrice} responde ${multiplier} mais ${window}.`;
}

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

export default function LandingV6() {
    const [heroProfile, setHeroProfile] = useState<HeroProfileId | null>(null);
    const [selectedDiagnosis, setSelectedDiagnosis] = useState<string[]>([]);

    const [simIcp, setSimIcp] = useState<SimulationIcp>("SaaS B2B");
    const [simChannel, setSimChannel] = useState<SimulationChannel>("Email");
    const [simGoal, setSimGoal] = useState<SimulationGoal>("Conversa");
    const [simulation, setSimulation] = useState<SimulationResult | null>(null);

    const [confidence, setConfidence] = useState(50);

    const [genSegment, setGenSegment] = useState("SaaS B2B");
    const [genPrice, setGenPrice] = useState("99");
    const [genChannel, setGenChannel] = useState("Email");
    const [generatedSignal, setGeneratedSignal] = useState<string | null>(null);

    const [progress, setProgress] = useState<Record<ProgressKey, boolean>>({
        connect: false,
        campaign: false,
        signal: false,
    });

    const heroReflection = heroChoices.find((choice) => choice.id === heroProfile)?.reflection ?? "";
    const confidenceState = getConfidenceState(confidence);
    const completedSteps = Object.values(progress).filter(Boolean).length;
    const allDone = completedSteps === progressSteps.length;
    const diagnosisCount = selectedDiagnosis.length;
    const diagnosisResult =
        diagnosisCount === 0
            ? ""
            : diagnosisCount <= 2
              ? "Você executa outbound, mas não acumula aprendizado."
              : diagnosisCount <= 4
                ? "Seu time gera dados todos os dias e joga fora."
                : "Você já tem um Signal Engine informal. Falta sistema.";

    function toggleDiagnosis(option: string) {
        setSelectedDiagnosis((prev) =>
            prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
        );
    }

    function runSimulation() {
        setSimulation(buildSimulation(simIcp, simChannel, simGoal));
    }

    function toggleProgress(step: ProgressKey) {
        setProgress((prev) => ({ ...prev, [step]: true }));
    }

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
                        <span className="text-sm font-semibold" style={{ color: PALETTE.text }}>Leadflow</span>
                        <span
                            className={`${mono.className} rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]`}
                            style={{ color: PALETTE.accent, background: PALETTE.accentSoft, borderColor: "#AFC1DE" }}
                        >
                            outbound + signal engine
                        </span>
                    </div>
                    <nav className="hidden items-center gap-6 md:flex">
                        {[
                            ["#hero-choice", "Escolha"],
                            ["#diagnostico", "Diagnostico"],
                            ["#simulador", "Simulador"],
                            ["#confiabilidade", "Confianca"],
                            ["#gerador", "Gerador"],
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
                <section id="hero-choice" className="px-6 py-20 md:py-24">
                    <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
                        <motion.div {...reveal()}>
                            <SectionKicker>Visao Geral</SectionKicker>
                            <h1 className={`${heading.className} max-w-4xl text-4xl font-extrabold tracking-tight leading-[1.08] md:text-6xl md:leading-[1.04]`} style={{ color: PALETTE.text }}>
                                Outbound completo com memoria.
                                <span className="block">Voce vende hoje, aprende com dados reais e transforma isso em autoridade amanha.</span>
                            </h1>
                            <p className="mt-6 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.muted }}>
                                Leadflow faz o trabalho de outbound de ponta a ponta.
                                <br className="hidden md:block" />
                                Reaproveita os dados da operacao para gerar sinais publicos com numeros reais, que fortalecem sua autoridade.
                            </p>
                            <p className="mt-4 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.text }}>
                                Se voce faz outbound e constroi em publico, o Leadflow transforma sua operacao comercial em sinais que voce pode publicar com confianca.
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
                                    href="#simulador"
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
                                    Voce ja faz outbound hoje?
                                </p>
                                <div className="mt-4 grid gap-2">
                                    {heroChoices.map((choice) => (
                                        <button
                                            key={choice.id}
                                            type="button"
                                            onClick={() => setHeroProfile(choice.id)}
                                            className="rounded-lg border px-4 py-3 text-left transition"
                                            style={{
                                                borderColor: heroProfile === choice.id ? "#8AB8AD" : PALETTE.border,
                                                background: heroProfile === choice.id ? PALETTE.accentSoft : PALETTE.surfaceSoft,
                                            }}
                                        >
                                            <span className="text-sm font-semibold" style={{ color: PALETTE.text }}>{choice.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {heroProfile ? (
                                    <div className="mt-5 rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                        <p className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.accent }}>
                                            leitura instantanea
                                        </p>
                                        <p className="mt-2 text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                            {heroReflection}
                                        </p>
                                    </div>
                                ) : null}

                                <div className="mt-5 space-y-4">
                                    {summaryBlocks.map((block) => (
                                        <div key={block.title} className="rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surface }}>
                                            <p className="text-base font-semibold" style={{ color: PALETTE.text }}>{block.title}</p>
                                            <p className="mt-1 text-base leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>
                                                {block.text}
                                            </p>
                                        </div>
                                    ))}
                                    <div className="rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surface }}>
                                        <p className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.accent }}>
                                            prova tecnica
                                        </p>
                                        <p className="mt-1 text-base leading-relaxed md:text-[15px]" style={{ color: PALETTE.muted }}>
                                            Desenvolvido a partir de milhares de interacoes outbound analisadas em producao.
                                        </p>
                                    </div>
                                </div>
                            </Panel>
                        </motion.div>
                    </div>
                </section>

                <section id="diagnostico" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Auto-diagnostico</SectionKicker>
                        <SectionTitle>Onde seu time perde aprendizado no outbound?</SectionTitle>
                        <p className="mt-5 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.muted }}>
                            Marque os itens que acontecem com frequencia na sua rotina.
                        </p>

                        <div className="mt-8 grid gap-3 md:grid-cols-2">
                            {diagnosisOptions.map((item) => {
                                const active = selectedDiagnosis.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => toggleDiagnosis(item.id)}
                                        className="rounded-xl border p-4 text-left transition"
                                        style={{
                                            borderColor: active ? "#8AB8AD" : PALETTE.border,
                                            background: active ? PALETTE.accentSoft : PALETTE.surface,
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="inline-flex h-5 w-5 items-center justify-center rounded border text-xs"
                                                style={{
                                                    borderColor: active ? PALETTE.accent : PALETTE.border,
                                                    color: active ? PALETTE.accent : PALETTE.muted,
                                                    background: active ? "#EFF8F5" : PALETTE.surface,
                                                }}
                                            >
                                                {active ? "✓" : ""}
                                            </span>
                                            <p className="text-base leading-relaxed" style={{ color: PALETTE.text }}>{item.label}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <motion.div {...reveal(0.1)} className="mt-6">
                            <Panel>
                                {diagnosisCount === 0 ? (
                                    <>
                                        <p className="text-lg font-semibold" style={{ color: PALETTE.text }}>
                                            Marque pelo menos 1 item para ver seu resultado.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-semibold" style={{ color: PALETTE.text }}>
                                            {diagnosisResult}
                                        </p>
                                    </>
                                )}
                            </Panel>
                        </motion.div>
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
                                    text: "Leadflow ajuda a prospectar, disparar, responder e acompanhar funil.",
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

                <section id="simulador" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Como funciona</SectionKicker>
                        <SectionTitle>Teste rapido: veja o que o Leadflow gera com uma campanha.</SectionTitle>
                        <p className="mt-5 max-w-3xl text-base leading-relaxed md:text-lg" style={{ color: PALETTE.muted }}>
                            Esta simulacao e didatica. Ela mostra, em 1 minuto, como o sistema transforma operacao em aprendizado reutilizavel.
                        </p>
                        <div className="mt-5 max-w-3xl rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                            <p className="text-sm leading-relaxed" style={{ color: PALETTE.text }}>
                                Nada real e enviado aqui. E apenas uma previa do fluxo: capturar dados, detectar padrao e sugerir um sinal para publicacao.
                            </p>
                        </div>
                        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1fr]">
                            <Panel>
                                <div className="grid gap-4">
                                    <label className="grid gap-1">
                                        <span className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                            Tipo de empresa
                                        </span>
                                        <select
                                            value={simIcp}
                                            onChange={(e) => setSimIcp(e.target.value as SimulationIcp)}
                                            className="h-11 rounded-md border px-3 text-sm"
                                            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.text }}
                                        >
                                            <option>SaaS B2B</option>
                                            <option>Agencia</option>
                                            <option>Outro</option>
                                        </select>
                                    </label>

                                    <label className="grid gap-1">
                                        <span className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                            Canal principal
                                        </span>
                                        <select
                                            value={simChannel}
                                            onChange={(e) => setSimChannel(e.target.value as SimulationChannel)}
                                            className="h-11 rounded-md border px-3 text-sm"
                                            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.text }}
                                        >
                                            <option>Email</option>
                                            <option>LinkedIn</option>
                                        </select>
                                    </label>

                                    <label className="grid gap-1">
                                        <span className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                            Meta da campanha
                                        </span>
                                        <select
                                            value={simGoal}
                                            onChange={(e) => setSimGoal(e.target.value as SimulationGoal)}
                                            className="h-11 rounded-md border px-3 text-sm"
                                            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.text }}
                                        >
                                            <option>Conversa</option>
                                            <option>Demo</option>
                                        </select>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={runSimulation}
                                        className={`${mono.className} mt-2 inline-flex h-11 items-center justify-center rounded-md px-5 text-xs font-semibold uppercase tracking-[0.14em]`}
                                        style={{ background: PALETTE.accent, color: "#F7FAFF" }}
                                    >
                                        Ver simulacao
                                    </button>
                                </div>
                            </Panel>

                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                    O que o sistema mostra para voce
                                </p>
                                {simulation ? (
                                    <div className="mt-4 space-y-4">
                                        <div className="rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                            <p className="text-sm font-semibold" style={{ color: PALETTE.text }}>
                                                Eventos capturados
                                            </p>
                                            <div className="mt-2 space-y-1">
                                                <DotItem>{`${simulation.replies} replies`}</DotItem>
                                                <DotItem>{`${simulation.ignores} ignores`}</DotItem>
                                                <DotItem>{`${simulation.conversions} conversoes`}</DotItem>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                            <p className="text-sm font-semibold" style={{ color: PALETTE.text }}>
                                                Padrao detectado
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                                {`Canal: ${simulation.channel}`}
                                            </p>
                                            <p className="text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                                {`Janela otima: ${simulation.bestWindow}`}
                                            </p>
                                            <p className="text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                                {`Confianca: ${simulation.confidence}%`}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                            <p className="text-sm font-semibold" style={{ color: PALETTE.text }}>
                                                Sinal sugerido
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed" style={{ color: PALETTE.text }}>
                                                {simulation.signal}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="mt-4 text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                                        Escolha tipo de empresa, canal e meta. Depois clique em Ver simulacao para enxergar exatamente o que o Leadflow devolve.
                                    </p>
                                )}
                            </Panel>
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

                <section id="confiabilidade" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border }}>
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
                                O Leadflow acumula memória comercial proprietária da sua operação.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1fr]">
                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                    Arraste a confiabilidade
                                </p>
                                <div className="mt-4">
                                    <input
                                        type="range"
                                        min={30}
                                        max={90}
                                        step={10}
                                        value={confidence}
                                        onChange={(e) => setConfidence(Number(e.target.value))}
                                        className="w-full"
                                        style={{ accentColor: PALETTE.accent }}
                                    />
                                    <div className={`${mono.className} mt-2 flex justify-between text-[11px] uppercase tracking-[0.1em]`} style={{ color: PALETTE.muted }}>
                                        <span>30%</span>
                                        <span>50%</span>
                                        <span>80%</span>
                                        <span>90%</span>
                                    </div>
                                </div>
                            </Panel>

                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                    Leitura atual
                                </p>
                                <div className="mt-3 rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                    <p className="text-base font-semibold" style={{ color: PALETTE.text }}>
                                        {confidence}% - {confidenceState.label}
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                        {confidenceState.helper}
                                    </p>
                                </div>
                                <p className="mt-3 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                    Assim você entende a qualidade do sinal em segundos, sem precisar entrar em jargão estatístico.
                                </p>
                            </Panel>
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

                <section id="gerador" className="border-t px-6 py-20" style={{ borderColor: PALETTE.border, background: PALETTE.bgAlt }}>
                    <div className="mx-auto max-w-6xl">
                        <SectionKicker>Exemplos Reais</SectionKicker>
                        <SectionTitle>Conteúdo que nasce dos seus dados e pode ser gerado em segundos.</SectionTitle>
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

                        <div className="mt-6 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                    Gere um exemplo de sinal
                                </p>
                                <div className="mt-4 grid gap-4">
                                    <label className="grid gap-1">
                                        <span className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                            Segmento
                                        </span>
                                        <select
                                            value={genSegment}
                                            onChange={(e) => setGenSegment(e.target.value)}
                                            className="h-11 rounded-md border px-3 text-sm"
                                            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.text }}
                                        >
                                            <option>SaaS B2B</option>
                                            <option>Agencia</option>
                                            <option>Ecommerce</option>
                                            <option>Outro</option>
                                        </select>
                                    </label>

                                    <label className="grid gap-1">
                                        <span className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                            Preco do produto (USD)
                                        </span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={genPrice}
                                            onChange={(e) => setGenPrice(e.target.value)}
                                            className="h-11 rounded-md border px-3 text-sm"
                                            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.text }}
                                        />
                                    </label>

                                    <label className="grid gap-1">
                                        <span className={`${mono.className} text-[11px] uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                            Canal
                                        </span>
                                        <select
                                            value={genChannel}
                                            onChange={(e) => setGenChannel(e.target.value)}
                                            className="h-11 rounded-md border px-3 text-sm"
                                            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.text }}
                                        >
                                            <option>Email</option>
                                            <option>LinkedIn</option>
                                        </select>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setGeneratedSignal(generateSignal(genSegment, genPrice, genChannel))}
                                        className={`${mono.className} mt-2 inline-flex h-11 items-center justify-center rounded-md px-5 text-xs font-semibold uppercase tracking-[0.14em]`}
                                        style={{ background: PALETTE.accent, color: "#F7FAFF" }}
                                    >
                                        Gerar sinal
                                    </button>
                                </div>
                            </Panel>

                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                    Output sugerido
                                </p>
                                {generatedSignal ? (
                                    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surfaceSoft }}>
                                        <p className="text-base leading-relaxed" style={{ color: PALETTE.text }}>
                                            {generatedSignal}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="mt-4 text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                                        Escolha segmento, preco e canal para gerar um exemplo de sinal no formato de publicacao.
                                    </p>
                                )}
                                <p className="mt-3 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                    Nenhum post e publicado automaticamente. Voce revisa e decide quando publicar.
                                </p>
                            </Panel>
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
                    <div className="mx-auto max-w-5xl">
                        <SectionKicker>CTA Final</SectionKicker>
                        <div className="text-center">
                            <h2 className={`${heading.className} text-4xl font-extrabold tracking-tight md:text-6xl`} style={{ color: PALETTE.text }}>
                                Comece a gerar sinais.
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed" style={{ color: PALETTE.text }}>
                                Faça outbound como sempre.
                                <br />
                                Aprenda como quase ninguém.
                            </p>
                        </div>

                        <div className="mt-10 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                    Fluxo de ativacao
                                </p>
                                <p className="mt-2 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                    Clique em cada passo para marcar como simulado.
                                </p>
                                <div className="mt-4 space-y-3">
                                    {progressSteps.map((step) => {
                                        const done = progress[step.key];
                                        return (
                                            <button
                                                key={step.key}
                                                type="button"
                                                onClick={() => toggleProgress(step.key)}
                                                className="w-full rounded-xl border p-4 text-left transition"
                                                style={{
                                                    borderColor: done ? "#8AB8AD" : PALETTE.border,
                                                    background: done ? PALETTE.accentSoft : PALETTE.surface,
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-base font-semibold" style={{ color: PALETTE.text }}>
                                                        {step.title}
                                                    </p>
                                                    <span
                                                        className={`${mono.className} rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em]`}
                                                        style={{
                                                            background: done ? "#E5F5F0" : "#EEF1ED",
                                                            color: done ? PALETTE.accent : PALETTE.muted,
                                                        }}
                                                    >
                                                        {done ? "simulado" : "nao simulado"}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                                    {step.helper}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Panel>

                            <Panel className="h-full">
                                <p className={`${mono.className} text-xs uppercase tracking-[0.12em]`} style={{ color: PALETTE.muted }}>
                                    Progresso atual
                                </p>
                                <p className="mt-3 text-3xl font-bold" style={{ color: PALETTE.text }}>
                                    {completedSteps}/{progressSteps.length}
                                </p>
                                <p className="mt-1 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                    {allDone
                                        ? "Tudo pronto para ativar seu primeiro ciclo de sinais."
                                        : "Clique nos passos para marcar como simulado e acompanhar o progresso."}
                                </p>
                                <a
                                    href="#"
                                    className={`${mono.className} mt-6 inline-flex h-12 w-full items-center justify-center rounded-md px-6 text-xs font-semibold uppercase tracking-[0.14em]`}
                                    style={{ background: PALETTE.accent, color: "#F7FAFF" }}
                                >
                                    Ativar Signal Engine no Leadflow
                                </a>
                                <p className="mt-3 text-sm leading-relaxed" style={{ color: PALETTE.muted }}>
                                    Outbound completo + Signal Engine. Sem post automatico. Sem achismo.
                                </p>

                                <div className="mt-5 rounded-xl border p-4" style={{ borderColor: PALETTE.border, background: PALETTE.surface }}>
                                    <p className="text-sm leading-relaxed" style={{ color: PALETTE.text }}>
                                        Nenhum post e publicado automaticamente.
                                    </p>
                                    <p className="text-sm leading-relaxed" style={{ color: PALETTE.text }}>
                                        Nenhum dado e exposto sem sua aprovacao.
                                    </p>
                                </div>

                                <p className="mt-4 text-sm" style={{ color: PALETTE.muted }}>
                                    Construido por founders que fazem outbound todos os dias.
                                </p>
                            </Panel>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t px-6 py-10" style={{ borderColor: PALETTE.border, background: PALETTE.surface }}>
                <div className="mx-auto max-w-6xl">
                    <p className="text-base leading-relaxed" style={{ color: PALETTE.muted }}>
                        Leadflow é um sistema de outbound que transforma atividade comercial em sinais públicos e
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

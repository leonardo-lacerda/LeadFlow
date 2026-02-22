"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

const sans = IBM_Plex_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.5, ease: "easeOut" as const, delay },
});

const quickPoints = [
    "captura eventos reais do outbound",
    "detecta padroes com confianca estatistica",
    "gera conteudo pronto com dados de verdade",
];

const layers = [
    {
        id: "Layer 01",
        title: "Event Capture",
        intro: "Tudo que ja acontece no Lastreia vira evento tipado.",
        items: [
            "mensagens enviadas",
            "replies",
            "ignores",
            "conversoes",
            "canal",
            "timing",
        ],
        note: "Nada novo pra voce fazer.",
    },
    {
        id: "Layer 02",
        title: "Pattern Detector",
        intro: "O sistema cruza eventos e detecta padroes reais.",
        items: [
            "so mostra insights com confianca estatistica",
            "sempre com base amostral",
            "sempre com contraste",
            "sem achismo",
            "sem hype",
        ],
        note: "So sinal valido.",
    },
    {
        id: "Layer 03",
        title: "Distribution Generator",
        intro: "Cada padrao vira conteudo pronto para publicar.",
        items: [
            "tweets",
            "threads",
            "graficos exportaveis",
            "micro-cases",
        ],
        note: "Voce revisa. Voce aprova. Voce posta.",
    },
];

const defensibilityItems = [
    "dados comerciais reais",
    "historico acumulado",
    "padroes longitudinais",
    "confianca estatistica",
    "network effect indireto",
];

const fitYes = [
    "founders tecnicos",
    "SaaS B2B",
    "devs que fazem outbound",
    "quem odeia marketing vazio",
];

const fitNo = [
    "quem quer spam",
    "quem quer lead garantido",
    "quem quer post automatico",
    "quem quer atalho magico",
];

const cycle = [
    "Usa Lastreia",
    "Dados acumulam",
    "Padroes emergem",
    "Conteudo com numeros reais",
    "Autoridade publica",
    "Inbound",
    "Mais dados",
];

const heatmapDays = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const heatmapHours = ["08h", "10h", "12h", "14h"];
const heatmapValues = [
    [16, 23, 20, 15, 12],
    [24, 41, 36, 22, 17],
    [21, 35, 31, 20, 16],
    [17, 28, 24, 17, 13],
];

function heatColor(value: number) {
    if (value >= 35) return "#0B5FFF";
    if (value >= 28) return "#4C7DFF";
    if (value >= 20) return "#A6BFFF";
    return "#E6EDFF";
}

function heatTextColor(value: number) {
    return value >= 28 ? "#F8FAFC" : "#0F172A";
}

function SectionHeading({
    id,
    label,
    title,
    description,
}: {
    id?: string;
    label: string;
    title: string;
    description?: string;
}) {
    return (
        <div id={id} className="mb-12">
            <p className={`${mono.className} text-xs uppercase tracking-[0.16em] text-slate-500`}>{label}</p>
            <h2 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight text-slate-900 md:text-[46px] md:leading-[1.08]">
                {title}
            </h2>
            {description ? (
                <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700">{description}</p>
            ) : null}
        </div>
    );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_6px_18px_rgba(15,23,42,0.05)] md:p-8 ${className}`}
        >
            {children}
        </div>
    );
}

function ListItem({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-start gap-3 text-base leading-relaxed text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0B5FFF]" />
            <span>{children}</span>
        </div>
    );
}

export default function LandingV5() {
    return (
        <div className={`${sans.className} min-h-screen bg-[#F8FAFC] text-slate-900 antialiased`}>
            <header className="fixed top-0 z-50 w-full border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <span className="text-base font-semibold tracking-tight">Lastreia</span>
                        <span
                            className={`${mono.className} rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-600`}
                        >
                            signal engine
                        </span>
                    </div>
                    <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
                        <a href="#problema" className="hover:text-slate-900">Problema</a>
                        <a href="#como-funciona" className="hover:text-slate-900">Camadas</a>
                        <a href="#exemplos" className="hover:text-slate-900">Exemplos</a>
                        <a href="#cta-final" className="hover:text-slate-900">Ativar</a>
                    </nav>
                </div>
            </header>

            <main className="pt-16">
                <section className="px-6 py-16 md:py-24">
                    <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
                        <motion.div {...reveal()}>
                            <p className={`${mono.className} mb-4 text-xs uppercase tracking-[0.16em] text-slate-500`}>
                                Engenharia aplicada ao comercial
                            </p>
                            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl md:leading-[1.05]">
                                Transforme atividade comercial em sinais publicos que geram clientes.
                            </h1>
                            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-700">
                                Lastreia captura dados reais do seu outbound, detecta padroes confiaveis e transforma
                                isso em conteudo que constroi autoridade e traz inbound automaticamente.
                            </p>

                            <div className="mt-6 space-y-2">
                                {quickPoints.map((point) => (
                                    <ListItem key={point}>{point}</ListItem>
                                ))}
                            </div>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <a
                                    href="#cta-final"
                                    className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md bg-[#0B5FFF] px-6 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#0A53DE]`}
                                >
                                    Comecar a gerar sinais reais
                                </a>
                                <a
                                    href="#como-funciona"
                                    className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-xs uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400 hover:text-slate-900`}
                                >
                                    Ver como funciona
                                </a>
                            </div>
                        </motion.div>

                        <motion.div {...reveal(0.1)}>
                            <Panel>
                                <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-slate-500`}>
                                    Runtime feed
                                </p>
                                <div className="mt-5 space-y-3">
                                    {[
                                        ["events today", "1.284"],
                                        ["patterns confirmed", "19"],
                                        ["signal posts ready", "7"],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="flex items-center justify-between border-b border-slate-200 pb-3 last:border-none last:pb-0"
                                        >
                                            <span className={`${mono.className} text-xs text-slate-500`}>{label}</span>
                                            <span className={`${mono.className} text-sm font-semibold text-slate-900`}>{value}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className={`${mono.className} text-[11px] uppercase tracking-[0.14em] text-slate-500`}>
                                        reply rate por horario (7 dias)
                                    </p>
                                    <div className="mt-3 flex h-16 items-end gap-1">
                                        {[39, 45, 58, 72, 67, 54, 47].map((h, index) => (
                                            <motion.span
                                                key={index}
                                                initial={{ height: 0 }}
                                                animate={{ height: `${h}%` }}
                                                transition={{ duration: 0.45, delay: index * 0.05, ease: "easeOut" as const }}
                                                className="block flex-1 rounded-[3px] bg-[#0B5FFF]/75"
                                            />
                                        ))}
                                    </div>
                                </div>
                            </Panel>
                        </motion.div>
                    </div>
                </section>

                <section id="problema" className="border-t border-slate-200 bg-white px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading
                            label="02 Problema"
                            title="Outbound gera dados. Quase ninguem usa isso direito."
                            description="Voce ja tem replies, ignores, conversoes, horarios, canais e ICPs. Mas tudo isso morre em dashboards internos que ninguem ve."
                        />
                        <div className="grid gap-4 md:grid-cols-2">
                            <motion.div {...reveal()}>
                                <Panel>
                                    <h3 className="text-xl font-semibold text-slate-900">Voce ja tem esses dados</h3>
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        {[
                                            "replies",
                                            "ignores",
                                            "conversoes",
                                            "horarios",
                                            "canais",
                                            "ICPs",
                                        ].map((item) => (
                                            <div key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                <span className={`${mono.className} text-sm text-slate-700`}>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>

                            <motion.div {...reveal(0.08)}>
                                <Panel>
                                    <h3 className="text-xl font-semibold text-slate-900">Enquanto isso</h3>
                                    <div className="mt-4 space-y-3">
                                        {[
                                            "voce nao sabe o que postar",
                                            "nao constroi autoridade",
                                            "depende de sorte pra inbound",
                                        ].map((item) => (
                                            <div key={item} className="flex items-start gap-3 border-b border-slate-200 pb-3 text-base text-slate-700 last:border-none last:pb-0">
                                                <span className={`${mono.className} text-slate-500`}>x</span>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section className="border-t border-slate-200 px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading
                            label="03 Tese"
                            title="Marketing nao deveria ser criativo. Deveria ser consequencia."
                            description="O Lastreia trata seu outbound como um sistema observavel: tudo vira evento, eventos viram padroes e padroes viram sinais publicos."
                        />
                        <motion.div {...reveal()}>
                            <Panel>
                                <div className="space-y-3">
                                    {[
                                        ["atividade outbound", "evento"],
                                        ["eventos", "padroes"],
                                        ["padroes", "sinais publicos"],
                                        ["sinais publicos", "autoridade + inbound"],
                                    ].map(([from, to], index) => (
                                        <div
                                            key={from}
                                            className="flex items-center gap-4 border-b border-slate-200 pb-3 text-base last:border-none last:pb-0"
                                        >
                                            <span className={`${mono.className} text-xs text-slate-400`}>
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span className="text-slate-700">{from}</span>
                                            <span className="h-px flex-1 bg-slate-200" />
                                            <span className={`${mono.className} text-xs uppercase tracking-[0.12em] text-[#0B5FFF]`}>
                                                {to}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-6 text-lg leading-relaxed text-slate-700">
                                    Voce nao escreve marketing. Voce publica o que o sistema aprende.
                                </p>
                            </Panel>
                        </motion.div>
                    </div>
                </section>

                <section id="como-funciona" className="border-t border-slate-200 bg-white px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading label="04 Camadas" title="Como funciona em 3 camadas." />
                        <div className="grid gap-4 md:grid-cols-3">
                            {layers.map((layer, index) => (
                                <motion.div key={layer.title} {...reveal(index * 0.06)}>
                                    <Panel className="h-full">
                                        <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-slate-500`}>
                                            {layer.id}
                                        </p>
                                        <h3 className="mt-3 text-2xl font-semibold text-slate-900">{layer.title}</h3>
                                        <p className="mt-3 text-base leading-relaxed text-slate-700">{layer.intro}</p>
                                        <div className="mt-4 space-y-2">
                                            {layer.items.map((item) => (
                                                <ListItem key={item}>{item}</ListItem>
                                            ))}
                                        </div>
                                        <p className={`${mono.className} mt-5 text-sm text-slate-500`}>{layer.note}</p>
                                    </Panel>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="exemplos" className="border-t border-slate-200 px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading
                            label="05 Exemplos"
                            title="Conteudo que so existe porque voce usa o Lastreia."
                        />
                        <div className="grid gap-4 md:grid-cols-3">
                            <motion.div {...reveal()}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-slate-500`}>
                                        Exemplo 1 - Tweet
                                    </p>
                                    <p className="mt-4 text-base leading-relaxed text-slate-700">
                                        Analisando 312 mensagens outbound: SaaS B2B com ticket menor que 99 dolares
                                        respondem 2.3x mais entre 10h e 12h as tercas. Outbound nao e copy. E timing.
                                    </p>
                                </Panel>
                            </motion.div>

                            <motion.div {...reveal(0.08)}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-slate-500`}>
                                        Exemplo 2 - Grafico
                                    </p>
                                    <p className="mt-4 text-sm text-slate-600">Heatmap de reply rate por horario e dia</p>
                                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                                        <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-[1px] bg-slate-200">
                                            <div className="bg-white px-2 py-1" />
                                            {heatmapDays.map((day) => (
                                                <div
                                                    key={day}
                                                    className={`${mono.className} bg-white px-2 py-2 text-center text-[11px] text-slate-500`}
                                                >
                                                    {day}
                                                </div>
                                            ))}
                                            {heatmapHours.map((hour, rowIndex) => (
                                                <div key={hour} className="contents">
                                                    <div className={`${mono.className} bg-white px-2 py-2 text-[11px] text-slate-500`}>
                                                        {hour}
                                                    </div>
                                                    {heatmapValues[rowIndex].map((value, colIndex) => (
                                                        <div
                                                            key={`${hour}-${heatmapDays[colIndex]}`}
                                                            className={`${mono.className} flex h-10 items-center justify-center text-[11px]`}
                                                            style={{
                                                                backgroundColor: heatColor(value),
                                                                color: heatTextColor(value),
                                                            }}
                                                        >
                                                            {value}%
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Panel>
                            </motion.div>

                            <motion.div {...reveal(0.15)}>
                                <Panel className="h-full">
                                    <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-slate-500`}>
                                        Exemplo 3 - Micro-case
                                    </p>
                                    <p className="mt-4 text-base leading-relaxed text-slate-700">
                                        Mudamos o CTA para empresas de logistica apos detectar 41% mais replies em
                                        mensagens curtas. Resultado: 3 demos em 7 dias.
                                    </p>
                                    <div className="mt-5 grid grid-cols-3 gap-2">
                                        {[
                                            ["41%", "mais replies"],
                                            ["3", "demos"],
                                            ["7 dias", "janela"],
                                        ].map(([value, label]) => (
                                            <div
                                                key={label}
                                                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center"
                                            >
                                                <p className={`${mono.className} text-base font-semibold text-[#0B5FFF]`}>
                                                    {value}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section className="border-t border-slate-200 bg-white px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading label="06 Loop" title="O produto gera seus proprios clientes." />
                        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                            <motion.div {...reveal()}>
                                <Panel>
                                    <div className="space-y-3">
                                        {cycle.map((step, index) => (
                                            <div
                                                key={step}
                                                className="flex items-start gap-4 border-b border-slate-200 pb-3 text-base text-slate-700 last:border-none last:pb-0"
                                            >
                                                <span className={`${mono.className} text-xs text-slate-400`}>
                                                    {String(index + 1).padStart(2, "0")}
                                                </span>
                                                <span>{step}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>

                            <motion.div {...reveal(0.08)}>
                                <Panel>
                                    <h3 className="text-xl font-semibold text-slate-900">Quem copia o codigo nao copia</h3>
                                    <div className="mt-4 space-y-3">
                                        {[
                                            "seu historico",
                                            "seus padroes",
                                            "sua credibilidade",
                                        ].map((item) => (
                                            <div
                                                key={item}
                                                className="flex items-start gap-3 border-b border-slate-200 pb-3 text-base text-slate-700 last:border-none last:pb-0"
                                            >
                                                <span className={`${mono.className} text-[#0B5FFF]`}>+</span>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section className="border-t border-slate-200 px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading
                            label="07 Defensavel"
                            title="Isso nao e copiavel em um fim de semana."
                            description="Codigo e commodity. Dados reais nao."
                        />
                        <motion.div {...reveal()} className="grid gap-3 md:grid-cols-2">
                            {defensibilityItems.map((item) => (
                                <div key={item} className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                                    <p className="text-base text-slate-700">{item}</p>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </section>

                <section className="border-t border-slate-200 bg-white px-6 py-20">
                    <div className="mx-auto max-w-6xl">
                        <SectionHeading label="08 Fit" title="Para quem e. E pra quem nao e." />
                        <div className="grid gap-4 md:grid-cols-2">
                            <motion.div {...reveal()}>
                                <Panel>
                                    <h3 className="text-xl font-semibold text-slate-900">Para quem e</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitYes.map((item) => (
                                            <ListItem key={item}>{item}</ListItem>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>

                            <motion.div {...reveal(0.08)}>
                                <Panel>
                                    <h3 className="text-xl font-semibold text-slate-900">Nao e para</h3>
                                    <div className="mt-4 space-y-2">
                                        {fitNo.map((item) => (
                                            <div key={item} className="flex items-start gap-3 text-base leading-relaxed text-slate-700">
                                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section id="cta-final" className="border-t border-slate-200 px-6 py-24">
                    <div className="mx-auto max-w-3xl text-center">
                        <motion.h2 {...reveal()} className="text-4xl font-bold tracking-tight text-slate-900 md:text-6xl md:leading-[1.08]">
                            Pare de postar opiniao. Comece a publicar sinais.
                        </motion.h2>
                        <motion.div {...reveal(0.1)} className="mt-9">
                            <a
                                href="#"
                                className={`${mono.className} inline-flex h-12 items-center justify-center rounded-md bg-[#0B5FFF] px-8 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#0A53DE]`}
                            >
                                Ativar Signal Engine no Lastreia
                            </a>
                            <p className="mt-4 text-base text-slate-700">
                                Leva menos de 5 minutos. Sem postar nada automaticamente.
                            </p>
                        </motion.div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-200 bg-white px-6 py-10">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <p className="max-w-3xl text-base leading-relaxed text-slate-700">
                        Lastreia e um sistema de outbound que transforma atividade comercial em aprendizado publico e
                        distribuicao organica.
                    </p>
                    <p className={`${mono.className} text-xs uppercase tracking-[0.16em] text-[#0B5FFF]`}>
                        Signals, not spam.
                    </p>
                </div>
            </footer>
        </div>
    );
}

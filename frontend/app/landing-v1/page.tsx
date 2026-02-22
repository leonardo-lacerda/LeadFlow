"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// V4 — Signal Engine — PREMIUM OFF-WHITE
// Fundo: #F7F6F3 (off-white quente), texto: #0D0D0D
// Cards: #FFFFFF com sombra elevation real
// Acento: #00956F (teal profundo — mais sóbrio que o anterior)
// Seções: alternância #F7F6F3 / #FFFFFF
// Tipografia: extrabold grandes + body 16px confortável
// Efeito: Stripe / Resend / Railway — infra premium, não SaaS genérico

const TEAL = "#00956F";
const BG = "#F7F6F3";
const CARD = "#FFFFFF";

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5, delay, ease: "easeOut" as const },
});

function Tag({ children }: { children: React.ReactNode }) {
    return (
        <span
            className="inline-block text-xs font-mono tracking-widest uppercase px-2.5 py-1 rounded-sm"
            style={{ color: TEAL, background: "#00956F14", border: "1px solid #00956F30" }}
        >
            {children}
        </span>
    );
}

function Divider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-4 mb-14">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-xs font-mono tracking-[0.2em] uppercase text-stone-400">{label}</span>
            <div className="h-px flex-1 bg-stone-200" />
        </div>
    );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`rounded-2xl border border-stone-200 p-8 ${className}`}
            style={{ background: CARD, boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.04)" }}
        >
            {children}
        </div>
    );
}

function LayerBlock({ tag, title, items, note }: { tag: string; title: string; items: string[]; note: string }) {
    return (
        <Card className="flex flex-col h-full">
            <div className="font-mono text-xs text-stone-400 mb-5">{tag}</div>
            <h3 className="text-lg font-bold text-stone-900 mb-6">{title}</h3>
            <ul className="space-y-3 flex-1">
                {items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-stone-600">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: TEAL }} />
                        {item}
                    </li>
                ))}
            </ul>
            <div className="mt-8 pt-5 border-t border-stone-100">
                <p className="text-xs font-mono text-stone-400">{note}</p>
            </div>
        </Card>
    );
}

export default function LandingV4() {
    const [email, setEmail] = useState("");
    const [done, setDone] = useState(false);

    return (
        <div className="min-h-screen font-sans antialiased" style={{ background: BG, color: "#0D0D0D" }}>

            {/* ── Header ─────────────────────────────────────── */}
            <header
                className="fixed top-0 w-full z-50 border-b border-stone-200/80"
                style={{ background: "rgba(247,246,243,0.92)", backdropFilter: "blur(12px)" }}
            >
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="font-black text-lg text-stone-900 tracking-tight">Lastreia</span>
                        <Tag>signal_engine</Tag>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm text-stone-500">
                        <a href="#problema" className="hover:text-stone-900 transition-colors">Problema</a>
                        <a href="#como-funciona" className="hover:text-stone-900 transition-colors">Como Funciona</a>
                        <a href="#exemplos" className="hover:text-stone-900 transition-colors">Exemplos</a>
                    </div>
                    <a
                        href="#cta"
                        className="h-9 px-5 rounded-lg text-sm font-semibold text-white flex items-center transition-opacity hover:opacity-90"
                        style={{ background: TEAL }}
                    >
                        Começar agora
                    </a>
                </div>
            </header>

            <main className="pt-14">

                {/* ── 1. HERO ────────────────────────────────────── */}
                <section className="min-h-[90vh] flex items-center justify-center px-6 text-center relative overflow-hidden" style={{ background: CARD }}>
                    {/* Subtle grid bg */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-30"
                        style={{
                            backgroundImage: "linear-gradient(#e7e5e4 1px, transparent 1px), linear-gradient(to right, #e7e5e4 1px, transparent 1px)",
                            backgroundSize: "48px 48px",
                        }}
                    />
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,1) 30%, rgba(255,255,255,0) 100%)" }} />

                    <div className="max-w-4xl mx-auto relative z-10">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
                            <Tag>Engenharia aplicada ao comercial</Tag>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-5xl md:text-[68px] font-black tracking-tighter leading-[1.05] text-stone-900 mb-8"
                        >
                            Transforme atividade<br />comercial em sinais{" "}
                            <span style={{ color: TEAL }}>públicos</span><br />
                            que geram clientes.
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-lg md:text-xl text-stone-500 leading-relaxed mb-12 max-w-2xl mx-auto"
                        >
                            Lastreia captura dados reais do seu outbound, detecta padrões confiáveis
                            e transforma isso em conteúdo que constrói autoridade e traz inbound — automaticamente.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        >
                            <a
                                href="#cta"
                                className="h-12 px-8 rounded-xl font-bold text-base text-white inline-flex items-center transition-opacity hover:opacity-90"
                                style={{ background: TEAL, boxShadow: `0 4px 16px ${TEAL}40` }}
                            >
                                Começar a gerar sinais reais
                            </a>
                            <a href="#problema" className="h-12 px-6 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors inline-flex items-center">
                                Ver como funciona ↓
                            </a>
                        </motion.div>
                    </div>
                </section>

                {/* ── 2. PROBLEMA ────────────────────────────────── */}
                <section id="problema" className="py-28 px-6" style={{ background: BG }}>
                    <div className="max-w-5xl mx-auto">
                        <Divider label="O Problema" />
                        <div className="grid md:grid-cols-2 gap-14 items-start">
                            <motion.div {...fadeUp()}>
                                <h2 className="text-3xl md:text-4xl font-black text-stone-900 leading-tight mb-6">
                                    Outbound gera dados.<br />
                                    Quase ninguém usa<br />isso direito.
                                </h2>
                                <p className="text-base text-stone-500 leading-relaxed">
                                    Você já tem replies, ignores, conversões, horários, canais e ICPs documentados.
                                    Mas tudo isso morre em dashboards internos que ninguém vê. Enquanto isso,
                                    você não sabe o que postar, não constrói autoridade e depende de sorte pra inbound.
                                </p>
                            </motion.div>
                            <motion.div {...fadeUp(0.1)} className="space-y-3">
                                <Card>
                                    <p className="text-xs font-mono text-stone-400 mb-4">{"// você já tem esses dados"}</p>
                                    <div className="space-y-2">
                                        {["replies", "ignores", "conversões", "horários", "canais", "ICPs"].map((d) => (
                                            <div key={d} className="flex items-center gap-3">
                                                <span className="flex-1 h-px bg-stone-100" />
                                                <span className="text-sm font-mono text-stone-500">{d}</span>
                                                <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ color: TEAL, background: "#00956F14" }}>capturado</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                                <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                                    <p className="text-xs font-mono text-stone-400 mb-4">{"// enquanto isso"}</p>
                                    {["você não sabe o que postar", "não constrói autoridade", "depende de sorte pra inbound"].map((d) => (
                                        <div key={d} className="flex items-center gap-3 py-2 text-sm text-stone-600">
                                            <span className="text-red-400 font-bold">×</span>{d}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── 3. A TESE ──────────────────────────────────── */}
                <section className="py-28 px-6 border-y border-stone-200" style={{ background: CARD }}>
                    <div className="max-w-5xl mx-auto">
                        <Divider label="A Tese" />
                        <div className="grid md:grid-cols-2 gap-14 items-center">
                            <motion.h2 {...fadeUp()} className="text-3xl md:text-4xl font-black text-stone-900 leading-tight">
                                Marketing não deveria<br />ser criativo.<br />
                                <span style={{ color: TEAL }}>Deveria ser consequência.</span>
                            </motion.h2>
                            <motion.div {...fadeUp(0.1)}>
                                <p className="text-base text-stone-500 leading-relaxed mb-10">
                                    O Lastreia trata seu outbound como um sistema observável.
                                    Você não escreve marketing. Você publica o que o sistema aprende.
                                </p>
                                <div className="font-mono text-sm space-y-0">
                                    {[
                                        ["atividade outbound", "evento tipado"],
                                        ["eventos", "padrões detectados"],
                                        ["padrões", "sinais públicos"],
                                        ["sinais públicos", "autoridade + inbound"],
                                    ].map(([from, to], i) => (
                                        <div key={i} className="flex items-center gap-4 py-3 border-b border-stone-100">
                                            <span className="text-stone-300 text-xs">{String(i + 1).padStart(2, "0")}</span>
                                            <span className="text-stone-500">{from}</span>
                                            <span className="flex-1 h-px bg-stone-100" />
                                            <span style={{ color: TEAL }} className="font-semibold">{to}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── 4. COMO FUNCIONA ───────────────────────────── */}
                <section id="como-funciona" className="py-28 px-6" style={{ background: BG }}>
                    <div className="max-w-5xl mx-auto">
                        <Divider label="Como Funciona" />
                        <h2 className="text-3xl font-black text-stone-900 text-center mb-4">As 3 camadas do Signal Engine</h2>
                        <p className="text-center text-stone-500 mb-16">Da captura ao conteúdo — sem nenhuma ação manual sua.</p>
                        <div className="grid md:grid-cols-3 gap-4">
                            <motion.div {...fadeUp(0)}><LayerBlock tag="layer_01 / event_capture" title="Event Capture" items={["mensagens enviadas", "replies recebidos", "ignores e bounces", "conversões e demos", "canal e timing"]} note="Nada novo pra você fazer." /></motion.div>
                            <motion.div {...fadeUp(0.1)}><LayerBlock tag="layer_02 / pattern_detector" title="Pattern Detector" items={["cruza eventos por segmento", "só mostra insights com confiança estatística", "sempre com base amostral", "sempre com contraste de período"]} note="Sem achismo. Sem hype." /></motion.div>
                            <motion.div {...fadeUp(0.2)}><LayerBlock tag="layer_03 / distribution_gen" title="Distribution Generator" items={["tweets prontos para publicar", "threads estruturadas", "gráficos exportáveis", "micro-cases de resultado"]} note="Você revisa. Você aprova. Você posta." /></motion.div>
                        </div>
                    </div>
                </section>

                {/* ── 5. EXEMPLOS CONCRETOS ──────────────────────── */}
                <section id="exemplos" className="py-28 px-6 border-y border-stone-200" style={{ background: CARD }}>
                    <div className="max-w-5xl mx-auto">
                        <Divider label="Exemplos Concretos" />
                        <h2 className="text-3xl font-black text-stone-900 text-center mb-4">Conteúdo que só existe porque você usa o Lastreia</h2>
                        <p className="text-center text-stone-400 mb-16">Não é copy de IA. É o que seus dados ensinaram.</p>
                        <div className="grid md:grid-cols-3 gap-4">
                            {/* Tweet */}
                            <motion.div {...fadeUp(0)}>
                                <Card className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-500">V</div>
                                            <div>
                                                <p className="text-xs font-bold text-stone-900">você</p>
                                                <p className="text-xs text-stone-400">@seu_handle</p>
                                            </div>
                                        </div>
                                        <Tag>tweet</Tag>
                                    </div>
                                    <p className="text-sm text-stone-700 leading-relaxed flex-1">
                                        &quot;Analisando 312 mensagens outbound:<br /><br />
                                        SaaS B2B com ticket &lt; $99 respondem 2.3× mais entre 10–12h às terças.<br /><br />
                                        Outbound não é copy. É timing.&quot;
                                    </p>
                                    <p className="text-xs font-mono text-stone-300 mt-6 pt-4 border-t border-stone-100">gerado pelo signal engine</p>
                                </Card>
                            </motion.div>

                            {/* Heatmap */}
                            <motion.div {...fadeUp(0.1)}>
                                <Card>
                                    <div className="flex items-center justify-between mb-5">
                                        <p className="text-xs font-mono text-stone-400">reply_rate_heatmap</p>
                                        <Tag>gráfico</Tag>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1 mb-2">
                                        {["Seg", "Ter", "Qua", "Qui", "Sex"].map((d) => (
                                            <div key={d} className="text-center text-xs text-stone-400">{d}</div>
                                        ))}
                                    </div>
                                    {[
                                        [0.05, 0.4, 0.15, 0.2, 0.05],
                                        [0.2, 0.95, 0.6, 0.4, 0.1],
                                        [0.35, 1.0, 0.75, 0.55, 0.25],
                                        [0.15, 0.5, 0.4, 0.25, 0.1],
                                        [0.05, 0.2, 0.15, 0.1, 0.05],
                                        [0.0, 0.05, 0.05, 0.05, 0.0],
                                    ].map((row, ri) => (
                                        <div key={ri} className="grid grid-cols-5 gap-1 mb-1">
                                            {row.map((val, ci) => (
                                                <div key={ci} className="h-6 rounded-sm" style={{ background: `rgba(0,149,111,${val * 0.85 + 0.04})` }} />
                                            ))}
                                        </div>
                                    ))}
                                    <div className="flex justify-between text-xs text-stone-300 mt-2 font-mono">
                                        <span>08h</span><span>10h</span><span>12h</span><span>14h</span><span>16h</span><span>18h</span>
                                    </div>
                                    <p className="text-xs text-stone-400 mt-3">Reply rate por horário e dia · últimos 30 dias</p>
                                </Card>
                            </motion.div>

                            {/* Micro-case */}
                            <motion.div {...fadeUp(0.2)}>
                                <Card className="flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-5">
                                        <p className="text-xs font-mono text-stone-400">micro_case_003</p>
                                        <Tag>case</Tag>
                                    </div>
                                    <blockquote className="text-sm text-stone-700 leading-relaxed flex-1">
                                        &quot;Mudamos o CTA para empresas de logística após detectar 41% mais
                                        replies em mensagens curtas. Resultado: 3 demos em 7 dias.&quot;
                                    </blockquote>
                                    <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-stone-100">
                                        {[{ n: "41%", l: "mais replies" }, { n: "7d", l: "para resultado" }, { n: "3", l: "demos geradas" }].map(({ n, l }) => (
                                            <div key={l} className="text-center">
                                                <div className="text-xl font-black" style={{ color: TEAL }}>{n}</div>
                                                <div className="text-xs text-stone-400 mt-0.5">{l}</div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── 6. CICLO VIRTUOSO ──────────────────────────── */}
                <section className="py-28 px-6" style={{ background: BG }}>
                    <div className="max-w-3xl mx-auto text-center">
                        <Divider label="O Ciclo Virtuoso" />
                        <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4">O produto gera seus próprios clientes.</h2>
                        <p className="text-stone-500 mb-16">Um loop autossustentável que o concorrente não replica do zero.</p>

                        <div className="space-y-0 text-sm font-mono mb-12">
                            {[
                                ["Usa Lastreia", "dados acumulam"],
                                ["dados acumulam", "padrões emergem"],
                                ["padrões emergem", "conteúdo com números reais"],
                                ["conteúdo publicado", "autoridade pública"],
                                ["autoridade pública", "inbound orgânico"],
                                ["mais clientes", "mais dados · loop"],
                            ].map(([from, to], i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.07 }}
                                    className="flex items-center gap-4 py-3.5 border-b border-stone-200"
                                >
                                    <span className="flex-1 text-right text-stone-400">{from}</span>
                                    <span className="font-bold" style={{ color: TEAL }}>→</span>
                                    <span className="flex-1 text-left text-stone-800 font-semibold">{to}</span>
                                </motion.div>
                            ))}
                        </div>

                        <Card className="text-left">
                            <p className="text-xs font-mono text-stone-400 mb-4">{"// quem copia o código não copia:"}</p>
                            {["seu histórico", "seus padrões", "sua credibilidade"].map((item) => (
                                <div key={item} className="flex items-center gap-3 py-2 text-sm text-stone-600">
                                    <span className="font-bold" style={{ color: TEAL }}>✓</span> {item}
                                </div>
                            ))}
                        </Card>
                    </div>
                </section>

                {/* ── 7. DEFENSABILIDADE ─────────────────────────── */}
                <section className="py-28 px-6 border-y border-stone-200" style={{ background: CARD }}>
                    <div className="max-w-5xl mx-auto">
                        <Divider label="Defensabilidade" />
                        <div className="grid md:grid-cols-2 gap-14 items-center">
                            <motion.div {...fadeUp()}>
                                <h2 className="text-3xl font-black text-stone-900 mb-6 leading-tight">
                                    Isso não é copiável<br />em um fim de semana.
                                </h2>
                                <p className="text-base text-stone-500 leading-relaxed">
                                    Código é commodity. Dados reais não. Sua vantagem competitiva é
                                    o histórico acumulado enquanto os concorrentes ainda chutam copy.
                                </p>
                            </motion.div>
                            <motion.div {...fadeUp(0.1)} className="space-y-2">
                                {[
                                    ["dados comerciais reais", "não disponível publicamente"],
                                    ["histórico acumulado", "cresce com o tempo"],
                                    ["padrões longitudinais", "requer operação ativa"],
                                    ["confiança estatística", "requer volume de dados"],
                                    ["network effect indireto", "mais clientes = sinal melhor"],
                                ].map(([item, detail]) => (
                                    <div key={item} className="flex items-center gap-4 p-4 rounded-xl border border-stone-200 bg-stone-50">
                                        <span className="text-sm font-semibold text-stone-800 flex-1">{item}</span>
                                        <span className="text-xs font-mono text-stone-400">{detail}</span>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── 8. PARA QUEM É ─────────────────────────────── */}
                <section className="py-28 px-6" style={{ background: BG }}>
                    <div className="max-w-4xl mx-auto">
                        <Divider label="Fit de Produto" />
                        <h2 className="text-3xl font-black text-stone-900 text-center mb-16">Para quem é — e para quem não é.</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <Card>
                                <p className="text-xs font-mono mb-6" style={{ color: TEAL }}>{"// is_a_fit === true"}</p>
                                {["founders técnicos com operação B2B", "SaaS que faz outbound ativamente", "devs que fazem prospecção própria", "quem odeia marketing sem dados", "quem quer construir autoridade real"].map((item, i, arr) => (
                                    <div key={item} className="flex items-start gap-3 py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid #f5f5f4" : "none" }}>
                                        <span style={{ color: TEAL }} className="font-bold">+</span>
                                        <span className="text-sm text-stone-700">{item}</span>
                                    </div>
                                ))}
                            </Card>
                            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-8">
                                <p className="text-xs font-mono text-red-400 mb-6">{"// is_a_fit === false"}</p>
                                {['quem quer fazer spam automático', 'quem quer "lead garantido"', "quem quer post automático sem revisão", "quem quer atalho mágico sem operação", "quem não roda outbound ativo"].map((item, i, arr) => (
                                    <div key={item} className="flex items-start gap-3 py-3" style={{ borderBottom: i < arr.length - 1 ? "1px solid #fee2e2" : "none" }}>
                                        <span className="text-red-400 font-bold">−</span>
                                        <span className="text-sm text-stone-600">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 9. CTA FINAL ───────────────────────────────── */}
                <section id="cta" className="py-32 px-6" style={{ background: "#0D1117" }}>
                    <div className="max-w-xl mx-auto text-center">
                        <motion.h2 {...fadeUp()} className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                            Pare de postar opinião.<br />
                            <span style={{ color: TEAL }}>Comece a publicar sinais.</span>
                        </motion.h2>
                        <motion.p {...fadeUp(0.1)} className="text-base text-stone-400 mb-10">
                            Ative o Signal Engine no Lastreia. Leva menos de 5 minutos.
                        </motion.p>
                        <motion.div {...fadeUp(0.2)}>
                            {!done ? (
                                <form onSubmit={(e) => { e.preventDefault(); setDone(true); }} className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto mb-4">
                                    <input
                                        type="email" required placeholder="seu@email.com.br"
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="flex-1 h-12 px-4 text-sm rounded-xl border border-stone-700 bg-stone-800 text-white placeholder:text-stone-500 focus:outline-none focus:ring-1"
                                        style={{ outlineColor: TEAL }}
                                    />
                                    <button
                                        type="submit"
                                        className="h-12 px-6 rounded-xl font-bold text-sm text-white whitespace-nowrap transition-opacity hover:opacity-90"
                                        style={{ background: TEAL, boxShadow: `0 4px 16px ${TEAL}40` }}
                                    >
                                        Ativar Signal Engine
                                    </button>
                                </form>
                            ) : (
                                <div className="flex items-center justify-center gap-3 h-12 px-6 rounded-xl max-w-sm mx-auto mb-4 border" style={{ background: "#00956F14", borderColor: "#00956F30" }}>
                                    <span style={{ color: TEAL }}>✓</span>
                                    <span className="text-sm text-stone-400">Acesso registrado. Entraremos em contato.</span>
                                </div>
                            )}
                            <p className="text-xs font-mono text-stone-600">Sem postar nada automaticamente.</p>
                        </motion.div>
                    </div>
                </section>

                {/* ── FOOTER ─────────────────────────────────────── */}
                <footer className="py-10 px-6 border-t border-stone-200" style={{ background: CARD }}>
                    <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <p className="font-black text-stone-900 mb-1">Lastreia</p>
                            <p className="text-xs text-stone-400 max-w-sm leading-relaxed">
                                Um sistema de outbound que transforma atividade comercial em aprendizado público e distribuição orgânica.
                            </p>
                        </div>
                        <span className="font-mono text-sm px-4 py-2 rounded-lg border border-stone-200 text-stone-500">
                            signals, not spam.
                        </span>
                    </div>
                </footer>
            </main>
        </div>
    );
}

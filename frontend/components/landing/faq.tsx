"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
    {
        question: "Lastreia e so mais uma ferramenta de e-mail frio?",
        answer: "Nao. Nosso foco e na infraestrutura por tras da operacao. O Lastreia entrega os leads, roda os disparos e principalmente: extrai sinais meta-analiticos da operacao para gerar visibilidade e autoridade para sua marca no LinkedIn/X.",
    },
    {
        question: "Como funciona a geracao de conteudo?",
        answer: "O Signal Engine acompanha sua operacao comercial. Se voce descobrir que 'CTOs de SaaS Serie A tem 47% mais chance de responder via WhatsApp', ele te avisa e monta um draft baseado NESSE DADO para voce divulgar.",
    },
    {
        question: "Quais dados sao compartilhados entre os usuarios?",
        answer: "Somente padroes agregados. Nome, email e dados da sua empresa JAMAIS sao compartilhados. Cuidamos do anonimato completo para que voce receba sinais confiaveis, mas sem comprometer a sua operacao.",
    },
    {
        question: "O Lastreia faz sentido para uma operacao pequena?",
        answer: "Sim, especialmente para equipes enxutas. Quanto menor a equipe, mais facil e cair no puro spam. O Lastreia te forca a operar como uma autoridade desde o primeiro dia: prospectando com precisao e gerando inbound como sub-produto.",
    },
];

export function LandingFAQ() {
    return (
        <section id="faq" className="py-24 bg-black border-t border-white/5">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="mb-16">
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
                        <span className="w-4 h-px bg-gray-600 block" /> F.A.Q.
                    </p>
                    <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight shrink-0">
                        Perguntas frequentes
                    </h2>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, idx) => (
                        <AccordionItem key={idx} value={`item-${idx}`} className="border-b border-white/10">
                            <AccordionTrigger className="text-white hover:text-gray-300 transition-colors text-left md:text-lg font-medium py-6">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-gray-400 text-base leading-relaxed font-light pb-6">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
    );
}

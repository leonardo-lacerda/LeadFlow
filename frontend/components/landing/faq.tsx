"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
    {
        question: "O Leadflow vende lead direto entre empresas?",
        answer: "Nao. O Leadflow nao e marketplace de lead. A plataforma entrega sinais, score, timing e recomendacao de canal para cada org executar com autonomia.",
    },
    {
        question: "Quais dados sao compartilhados entre SaaS?",
        answer: "Somente padroes anonimizados por segmento (ex.: reply rate por perfil e horario). Nome, email, conteudo da mensagem e origem da org nao sao compartilhados.",
    },
    {
        question: "Qual perfil de cliente encaixa no cohort inicial?",
        answer: "SaaS B2B com decisor tecnico, ticket recorrente e outbound leve (email + WhatsApp). Esse recorte reduz ruido e aumenta precisao dos sinais.",
    },
    {
        question: "Sem sinais de rede o produto ainda funciona?",
        answer: "Sim. O Leadflow opera com seus dados proprios e evolui conforme o volume coletivo cresce. Quanto mais orgs similares entram, mais forte fica o data moat.",
    },
    {
        question: "Qual resultado posso esperar?",
        answer: "A promessa nao e cliente garantido. A promessa e decisao comercial melhor: priorizacao mais inteligente, menos tentativa e erro e aumento consistente de resposta.",
    },
];

export function LandingFAQ() {
    return (
        <section id="faq" className="py-24 bg-black/50">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Perguntas frequentes
                    </h2>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, idx) => (
                        <AccordionItem key={idx} value={`item-${idx}`} className="border-white/10">
                            <AccordionTrigger className="text-white hover:text-indigo-400 transition-colors text-left md:text-lg">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-gray-400 text-base leading-relaxed">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
    );
}

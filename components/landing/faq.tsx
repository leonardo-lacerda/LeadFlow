"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
    {
        question: "Preciso conectar meu próprio email?",
        answer: "Sim! Você pode conectar contas do Gmail, Outlook ou qualquer provedor SMTP/IMAP. Recomendamos usar contas secundárias para proteger seu domínio principal."
    },
    {
        question: "Como funciona a integração com WhatsApp?",
        answer: "Utilizamos a API Oficial do WhatsApp Business (Cloud API) ou conexão via QR Code para instâncias web. Você pode criar fluxos que alternam entre email e mensagem automaticamente."
    },
    {
        question: "Os dados dos leads são confiáveis?",
        answer: "Nossa base é atualizada mensalmente e verificamos todos os emails em tempo real antes de você adicionar à campanha, garantindo taxa de entrega superior a 95%."
    },
    {
        question: "Posso cancelar a qualquer momento?",
        answer: "Com certeza. Não há fidelidade nos planos mensais. Se cancelar, você mantém o acesso até o fim do ciclo de cobrança vigente."
    },
    {
        question: "Vocês oferecem garantia?",
        answer: "Sim, oferecemos 7 dias de garantia incondicional. Se não gostar da ferramenta, devolvemos 100% do seu dinheiro."
    }
];

export function LandingFAQ() {
    return (
        <section id="faq" className="py-24 bg-black/50">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Perguntas Frequentes
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

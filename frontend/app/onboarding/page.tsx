"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { organizationApi } from "@/lib/organization-api";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
    IconArrowRight,
    IconBrandWhatsapp,
    IconChartBar,
    IconCheck,
    IconLoader,
    IconRocket,
    IconUsers,
} from "@tabler/icons-react";

const STEPS = [
    {
        id: "positioning",
        title: "Aquisição como Infraestrutura",
        icon: IconRocket,
        description:
            "Leadflow combina descoberta de leads com inteligência coletiva para decidir melhor quando e como abordar.",
        bullets: [
            "Leads com contexto, não apenas listas.",
            "Decisões orientadas por sinais agregados.",
            "Operação com menos tentativa e erro.",
        ],
    },
    {
        id: "lead-layer",
        title: "Camada de Leads",
        icon: IconUsers,
        description:
            "Sua base de prospecção continua no centro da operação, com organização por status, temperatura e prioridade.",
        bullets: [
            "Lead Discovery e enriquecimento de dados.",
            "Gestão de pipeline em uma única visão.",
            "Execução focada nos leads com maior potencial.",
        ],
    },
    {
        id: "signal-layer",
        title: "Camada de Sinais",
        icon: IconBrandWhatsapp,
        description:
            "A Signal Layer recomenda canal, janela e prioridade por perfil, com base no comportamento observado na rede.",
        bullets: [
            "Recomendação de canal (Email x WhatsApp).",
            "Melhor dia e horário para abordagem.",
            "Alertas acionáveis para respostas e riscos.",
        ],
    },
    {
        id: "intelligence",
        title: "Inteligência de Impacto",
        icon: IconChartBar,
        description:
            "No painel, você acompanha lift por canal e segmento para ajustar sequências de forma contínua.",
        bullets: [
            "Visão de impacto agregado da operação.",
            "Aprendizado contínuo por cohort e uso.",
            "Evolução de performance sem aumentar complexidade.",
        ],
    },
];

export default function OnboardingPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, updateUser } = useAuthStore();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;

        organizationApi
            .getOrganization()
            .then((organization) => {
                if (!active) {
                    return;
                }

                if (organization.onboardingCompleted) {
                    router.replace("/dashboard");
                    return;
                }

                if (user?.organization) {
                    updateUser({
                        organization: {
                            ...user.organization,
                            onboardingCompleted: Boolean(organization.onboardingCompleted),
                        },
                    });
                }
            })
            .catch(() => {
                // Keep page usable even if this check fails.
            });

        return () => {
            active = false;
        };
    }, [router, updateUser, user?.organization]);

    const completeOnboarding = async () => {
        setLoading(true);
        try {
            const updatedOrganization = await organizationApi.updateOrganization({
                onboardingCompleted: true,
            });

            if (user?.organization) {
                updateUser({
                    organization: {
                        ...user.organization,
                        ...updatedOrganization,
                        onboardingCompleted: true,
                    },
                });
            }

            toast({ title: "Onboarding concluído" });
            router.push("/dashboard");
        } catch {
            toast({
                title: "Erro ao finalizar onboarding",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (step < STEPS.length - 1) {
            setStep((prev) => prev + 1);
            return;
        }
        await completeOnboarding();
    };

    const currentStep = STEPS[step];
    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-3xl space-y-6">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Onboarding Leadflow</h1>
                    <p className="text-muted-foreground">
                        Uma visão rápida do produto em 4 passos.
                    </p>
                </div>

                <div className="relative">
                    <Progress value={progress} className="h-2" />
                    <div className="absolute top-4 w-full flex justify-between px-2">
                        {STEPS.map((item, index) => (
                            <div
                                key={item.id}
                                className={`flex flex-col items-center gap-2 ${index === step ? "text-primary" : "text-muted-foreground"}`}
                            >
                                <item.icon
                                    className={`h-6 w-6 ${index <= step ? "stroke-current" : "stroke-muted-foreground/50"}`}
                                />
                                <span className="text-xs font-medium hidden sm:block">{item.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-12">
                    <Card className="border-2 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <currentStep.icon className="h-5 w-5" />
                                {currentStep.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="min-h-[320px]">
                            <div className="space-y-5 py-2">
                                <p className="text-muted-foreground">{currentStep.description}</p>
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        {currentStep.bullets.map((item) => (
                                            <li key={item} className="flex items-start gap-2">
                                                <IconCheck className="h-4 w-4 mt-0.5 text-primary" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t p-6">
                            <Button
                                variant="outline"
                                onClick={() => setStep((prev) => prev - 1)}
                                disabled={step === 0 || loading}
                            >
                                Voltar
                            </Button>
                            <Button onClick={handleNext} disabled={loading}>
                                {loading && <IconLoader className="mr-2 h-4 w-4 animate-spin" />}
                                {step === STEPS.length - 1 ? "Concluir e ir para o painel" : "Próximo"}
                                {step !== STEPS.length - 1 && <IconArrowRight className="ml-2 h-4 w-4" />}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}

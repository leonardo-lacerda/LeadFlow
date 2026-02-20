"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { organizationApi } from "@/lib/organization-api";
import { integrationsApi, Mailbox, WhatsappInstance } from "@/lib/integrations-api";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { MailboxList } from "@/components/settings/integrations/mailbox-list";
import { WhatsappList } from "@/components/settings/integrations/whatsapp-list";
import {
    IconCheck,
    IconArrowRight,
    IconLoader,
    IconRocket,
    IconMail,
    IconBrandWhatsapp,
} from "@tabler/icons-react";

const STEPS = [
    { id: "welcome", title: "Signal Layer", icon: IconRocket },
    { id: "mailboxes", title: "Canal Email", icon: IconMail },
    { id: "whatsapp", title: "Canal WhatsApp", icon: IconBrandWhatsapp },
    { id: "finish", title: "Go Live", icon: IconCheck },
];

export default function OnboardingPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, updateUser } = useAuthStore();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
    const [instances, setInstances] = useState<WhatsappInstance[]>([]);

    const hasMailbox = mailboxes.length > 0;
    const hasWhatsapp = instances.length > 0;

    const refreshStatus = useCallback(async () => {
        try {
            const [emailData, whatsappData] = await Promise.all([
                integrationsApi.listMailboxes(),
                integrationsApi.listWhatsapp(),
            ]);
            setMailboxes(emailData);
            setInstances(whatsappData);
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        void refreshStatus();
    }, [refreshStatus]);

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

    const handleNext = async () => {
        if (step < STEPS.length - 1) {
            setStep((prev) => prev + 1);
            return;
        }
        await completeOnboarding();
    };

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

            toast({ title: "Ativacao concluida" });
            router.push("/dashboard");
        } catch {
            toast({
                title: "Erro ao finalizar ativacao",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const currentStep = STEPS[step];
    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-3xl space-y-6">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Ativacao do Signal Layer</h1>
                    <p className="text-muted-foreground">
                        Conecte seus canais e entre no aprendizado coletivo para aquisicao B2B.
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
                            {step === 0 && (
                                <div className="space-y-4 text-center py-8">
                                    <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                        <IconRocket className="h-12 w-12 text-primary" />
                                    </div>
                                    <h2 className="text-2xl font-bold">Bem-vindo ao Leadflow</h2>
                                    <p className="text-muted-foreground max-w-xl mx-auto">
                                        Aqui sua org nao recebe lead de outras empresas. Voce recebe sinais,
                                        scores e recomendacoes de timing para decidir melhor.
                                    </p>
                                    <div className="max-w-xl mx-auto rounded-lg border bg-muted/30 p-4 text-left text-sm text-muted-foreground">
                                        Cohort inicial: SaaS B2B com decisor tecnico, outbound leve e ICP sobreposto.
                                    </div>
                                </div>
                            )}

                            {step === 1 && (
                                <div className="space-y-4">
                                    <p className="text-muted-foreground mb-4">
                                        Adicione ao menos uma conta de email para enviar sequences e gerar sinais de resposta.
                                    </p>
                                    <MailboxList mailboxes={mailboxes} onRefresh={refreshStatus} />
                                    {hasMailbox && (
                                        <div className="p-4 bg-green-50 text-green-700 rounded-md flex items-center gap-2 mt-4">
                                            <IconCheck className="h-5 w-5" />
                                            <span>Email conectado. Signals de canal email habilitados.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4">
                                    <p className="text-muted-foreground mb-4">
                                        Opcional: conecte WhatsApp para ampliar cobertura de canal por segmento.
                                    </p>
                                    <WhatsappList instances={instances} onRefresh={refreshStatus} />
                                    {hasWhatsapp && (
                                        <div className="p-4 bg-green-50 text-green-700 rounded-md flex items-center gap-2 mt-4">
                                            <IconCheck className="h-5 w-5" />
                                            <span>WhatsApp conectado. Signals de canal WhatsApp habilitados.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4 text-center py-8">
                                    <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                                        <IconCheck className="h-12 w-12 text-green-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold">Tudo pronto para operar com signals</h2>
                                    <p className="text-muted-foreground max-w-md mx-auto">
                                        Sua base e seus canais estao ativos. Agora voce pode executar com
                                        contexto, nao por tentativa e erro.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between border-t p-6">
                            <Button
                                variant="outline"
                                onClick={() => setStep((prev) => prev - 1)}
                                disabled={step === 0 || loading}
                            >
                                Voltar
                            </Button>
                            <Button onClick={handleNext} disabled={loading || (step === 1 && !hasMailbox)}>
                                {loading && <IconLoader className="mr-2 h-4 w-4 animate-spin" />}
                                {step === STEPS.length - 1 ? "Ir para Dashboard" : "Proximo"}
                                {step !== STEPS.length - 1 && <IconArrowRight className="ml-2 h-4 w-4" />}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}

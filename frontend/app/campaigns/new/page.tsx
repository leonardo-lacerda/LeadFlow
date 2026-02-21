"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { IconArrowLeft, IconArrowRight, IconMail, IconBrandWhatsapp, IconArrowsShuffle } from "@tabler/icons-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SequenceBuilder } from "@/components/campaigns/sequence-builder";
import { LeadSelector } from "@/components/campaigns/lead-selector";
import { Step } from "@/components/campaigns/types";
import { campaignsApi, CreateCampaignData, CreateCampaignStep } from "@/lib/campaigns-api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ScheduleConfig, ScheduleSettings } from "@/components/campaigns/schedule-config";

const defaultSchedule: ScheduleSettings = {
    timezone: "America/Sao_Paulo",
    respectBusinessHours: true,
    businessHoursStart: "09:00",
    businessHoursEnd: "18:00",
    dailyLimit: 100,
    respectReplies: true,
    sendOnWeekends: false,
};

function normalizeScheduleSettings(value: unknown): ScheduleSettings {
    if (!value || typeof value !== "object") {
        return defaultSchedule;
    }

    const raw = value as Record<string, unknown>;

    return {
        timezone: typeof raw.timezone === "string" ? raw.timezone : defaultSchedule.timezone,
        respectBusinessHours:
            typeof raw.respectBusinessHours === "boolean"
                ? raw.respectBusinessHours
                : defaultSchedule.respectBusinessHours,
        businessHoursStart:
            typeof raw.businessHoursStart === "string"
                ? raw.businessHoursStart
                : defaultSchedule.businessHoursStart,
        businessHoursEnd:
            typeof raw.businessHoursEnd === "string"
                ? raw.businessHoursEnd
                : defaultSchedule.businessHoursEnd,
        dailyLimit:
            typeof raw.dailyLimit === "number"
                ? raw.dailyLimit
                : defaultSchedule.dailyLimit,
        respectReplies:
            typeof raw.respectReplies === "boolean"
                ? raw.respectReplies
                : defaultSchedule.respectReplies,
        sendOnWeekends:
            typeof raw.sendOnWeekends === "boolean"
                ? raw.sendOnWeekends
                : defaultSchedule.sendOnWeekends,
    };
}

export default function NewCampaignPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        type: "email" as "email" | "whatsapp" | "multi",
        audience: [] as string[],
        steps: [] as Step[],
        schedule: defaultSchedule,
    });

    useEffect(() => {
        const cloneId =
            typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("clone")
                : null;
        if (!cloneId) return;

        const loadClone = async () => {
            try {
                const campaign = await campaignsApi.getById(cloneId);
                const clonedSteps: Step[] = campaign.steps.map((step) => ({
                    id: step.id,
                    type: step.type.toLowerCase() as Step["type"],
                    title: step.subject || step.type,
                    content: step.content,
                    delay: step.delayHours || 0,
                }));

                setFormData((prev) => ({
                    ...prev,
                    name: `${campaign.name} (Copia)`,
                    type:
                        campaign.type === "MULTI_CHANNEL"
                            ? "multi"
                            : (campaign.type.toLowerCase() as "email" | "whatsapp"),
                    steps: clonedSteps,
                    schedule: normalizeScheduleSettings(campaign.schedule) || prev.schedule,
                }));
            } catch (error) {
                console.error("Erro ao clonar sequencia:", error);
                toast({
                    title: "Erro ao carregar sequencia",
                    variant: "destructive",
                });
            }
        };

        loadClone();
    }, [toast]);

    const nextStep = () => setStep((s) => s + 1);
    const prevStep = () => setStep((s) => s - 1);

    const handleSaveCampaign = async () => {
        try {
            setLoading(true);

            // Convert frontend steps to backend format
            const apiSteps: CreateCampaignStep[] = formData.steps.map((step) => ({
                type: step.type.toUpperCase() as "EMAIL" | "WHATSAPP" | "WAIT" | "CONDITION",
                subject: step.title,
                content: step.content || "",
                delayHours: step.delay || 0,
            }));

            const campaignData: CreateCampaignData = {
                name: formData.name,
                type:
                    formData.type === "multi"
                        ? "MULTI_CHANNEL"
                        : (formData.type.toUpperCase() as "EMAIL" | "WHATSAPP"),
                leadIds: formData.audience,
                steps: apiSteps,
                schedule: formData.schedule,
            };

            const campaign = await campaignsApi.create(campaignData);

            toast({
                title: "Sequencia criada!",
                description: `${campaign.name} foi criada com sucesso.`,
            });

            router.push("/campaigns");
        } catch (error) {
            console.error("Error saving campaign:", error);
            toast({
                title: "Erro ao salvar sequencia",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/campaigns">
                            <IconArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Nova Sequencia</h2>
                        <p className="text-muted-foreground">
                            Configure sua sequencia em 4 passos simples.
                        </p>
                    </div>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-center mb-8">
                    <div className="flex items-center gap-4">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex items-center gap-2">
                                <div
                                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step >= s
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "text-muted-foreground border-muted"
                                        }`}
                                >
                                    {s}
                                </div>
                                <span
                                    className={`text-sm ${step >= s ? "font-medium text-foreground" : "text-muted-foreground"
                                        }`}
                                >
                                    {s === 1 ? "Detalhes" : s === 2 ? "Audiencia" : s === 3 ? "Sequencia" : "Agendamento"}
                                </span>
                                {s < 4 && <div className="w-12 h-[2px] bg-muted" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="max-w-4xl mx-auto">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <Card className="max-w-2xl mx-auto">
                                    <CardHeader>
                                        <CardTitle>Detalhes da Sequencia</CardTitle>
                                        <CardDescription>
                                            De um nome e escolha o canal principal.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Nome da Sequencia</Label>
                                            <Input
                                                id="name"
                                                placeholder="Ex: Prospeccao CEO Tech Q3"
                                                value={formData.name}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, name: e.target.value })
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Canal Principal</Label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div
                                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${formData.type === "email"
                                                        ? "border-primary bg-primary/5"
                                                        : "border-muted hover:border-gray-300"
                                                        }`}
                                                    onClick={() => setFormData({ ...formData, type: "email" })}
                                                >
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                        <IconMail className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">Email</p>
                                                        <p className="text-xs text-muted-foreground">Sequencias de prospeccao por email</p>
                                                    </div>
                                                </div>

                                                <div
                                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${formData.type === "whatsapp"
                                                        ? "border-primary bg-primary/5"
                                                        : "border-muted hover:border-gray-300"
                                                        }`}
                                                    onClick={() => setFormData({ ...formData, type: "whatsapp" })}
                                                >
                                                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                        <IconBrandWhatsapp className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">WhatsApp</p>
                                                        <p className="text-xs text-muted-foreground">Mensagens diretas</p>
                                                    </div>
                                                </div>

                                                <div
                                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${formData.type === "multi"
                                                        ? "border-primary bg-primary/5"
                                                        : "border-muted hover:border-gray-300"
                                                        }`}
                                                    onClick={() => setFormData({ ...formData, type: "multi" })}
                                                >
                                                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                                        <IconArrowsShuffle className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">Multicanal</p>
                                                        <p className="text-xs text-muted-foreground">Email + WhatsApp</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end">
                                        <Button onClick={nextStep} disabled={!formData.name}>
                                            Proximo: Audiencia <IconArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Selecionar Audiencia</CardTitle>
                                        <CardDescription>
                                            Selecione os leads que entrarao nesta sequencia.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <LeadSelector
                                            selectedLeads={formData.audience}
                                            onSelectionChange={(ids) => setFormData({ ...formData, audience: ids })}
                                        />
                                    </CardContent>
                                    <CardFooter className="flex justify-between">
                                        <Button variant="outline" onClick={prevStep}>
                                            Voltar
                                        </Button>
                                        <Button onClick={nextStep} disabled={formData.audience.length === 0}>
                                            Proximo: Sequencia ({formData.audience.length}) <IconArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        )}


                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <Card className="border-0 shadow-none bg-transparent">
                                    <CardHeader className="px-0 pt-0">
                                        <CardTitle>Construir Sequencia</CardTitle>
                                        <CardDescription>
                                            Defina os passos e mensagens arrastando os elementos.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="px-0">
                                        <SequenceBuilder
                                            initialSteps={formData.steps}
                                            onStepsChange={(steps) => setFormData({ ...formData, steps })}
                                        />
                                    </CardContent>
                                    <CardFooter className="flex justify-between px-0">
                                        <Button variant="outline" onClick={prevStep}>
                                            Voltar
                                        </Button>
                                        <Button
                                            onClick={nextStep}
                                            disabled={formData.steps.length === 0}
                                        >
                                            Proximo: Agendamento <IconArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Configurar Agendamento</CardTitle>
                                        <CardDescription>
                                            Defina quando e como as mensagens serao enviadas.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ScheduleConfig
                                            value={formData.schedule}
                                            onChange={(schedule) => setFormData({ ...formData, schedule })}
                                        />
                                    </CardContent>
                                    <CardFooter className="flex justify-between">
                                        <Button variant="outline" onClick={prevStep}>
                                            Voltar
                                        </Button>
                                        <Button
                                            onClick={handleSaveCampaign}
                                            disabled={loading}
                                        >
                                            {loading ? "Salvando..." : "Finalizar e Publicar"}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </AppLayout>
    );
}



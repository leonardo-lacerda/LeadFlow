"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aiApi } from "@/lib/ai-api";
import { getErrorMessage } from "@/lib/error-utils";
import { useToast } from "@/hooks/use-toast";

const aiWorkspaceSchema = z.object({
    channel: z.enum(["email", "whatsapp"]),
    leadName: z.string(),
    companyName: z.string(),
    context: z.string(),
    tone: z.string().min(1),
    language: z.string().min(1),
    variants: z.number().int().min(1).max(5),
    promptId: z.string(),
    analysisText: z.string().min(1),
});

type AiWorkspaceFormInput = z.input<typeof aiWorkspaceSchema>;
type AiWorkspaceFormValues = z.output<typeof aiWorkspaceSchema>;

const DEFAULT_ANALYSIS_TEXT =
    "Oi, gostei da proposta, mas preciso validar com o time e retornar na proxima semana.";

export default function AiWorkspacePage() {
    const { toast } = useToast();

    const form = useForm<AiWorkspaceFormInput, unknown, AiWorkspaceFormValues>({
        resolver: zodResolver(aiWorkspaceSchema),
        defaultValues: {
            channel: "email",
            leadName: "",
            companyName: "",
            context: "",
            tone: "consultivo",
            language: "pt-BR",
            variants: 2,
            promptId: "",
            analysisText: DEFAULT_ANALYSIS_TEXT,
        },
    });

    const promptsQuery = useQuery({
        queryKey: ["ai", "prompts"],
        queryFn: () => aiApi.listPrompts(),
    });

    const generateMutation = useMutation({
        mutationFn: (values: AiWorkspaceFormValues) =>
            aiApi.generateMessage({
                type: values.channel,
                tone: values.tone,
                language: values.language,
                variants: values.variants,
                promptId: values.promptId || undefined,
                lead: {
                    fullName: values.leadName || undefined,
                    companyName: values.companyName || undefined,
                    context: values.context || undefined,
                },
            }),
        onError: (error) => {
            toast({
                title: "Erro ao gerar mensagem",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const intentMutation = useMutation({
        mutationFn: (values: AiWorkspaceFormValues) =>
            aiApi.analyzeIntent({
                message: values.analysisText,
                tone: values.tone,
                language: values.language,
                promptId: values.promptId || undefined,
            }),
        onError: (error) => {
            toast({
                title: "Erro ao analisar intent",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const sentimentMutation = useMutation({
        mutationFn: (values: AiWorkspaceFormValues) =>
            aiApi.analyzeSentiment({
                message: values.analysisText,
                tone: values.tone,
                language: values.language,
                promptId: values.promptId || undefined,
            }),
        onError: (error) => {
            toast({
                title: "Erro ao analisar sentimento",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const handleGenerate = form.handleSubmit((values) => generateMutation.mutate(values));
    const runAnalysis = form.handleSubmit(async (values) => {
        try {
            await Promise.all([intentMutation.mutateAsync(values), sentimentMutation.mutateAsync(values)]);
        } catch {
            // handled in onError handlers
        }
    });

    const generatedVariants = generateMutation.data?.variants || [];

    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI Workspace</h1>
                    <p className="text-muted-foreground">
                        Gere mensagens e analise intent/sentiment no mesmo fluxo.
                    </p>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gerador de Mensagens</CardTitle>
                            <CardDescription>Entrada minima: canal, lead e contexto.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="channel">Canal</Label>
                                    <select
                                        id="channel"
                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                        {...form.register("channel")}
                                    >
                                        <option value="email">Email</option>
                                        <option value="whatsapp">WhatsApp</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="variants">Variantes</Label>
                                    <Input
                                        id="variants"
                                        type="number"
                                        min={1}
                                        max={5}
                                        {...form.register("variants", {
                                            setValueAs: (value) => Number(value),
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="leadName">Lead</Label>
                                    <Input id="leadName" placeholder="Nome do lead" {...form.register("leadName")} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="companyName">Empresa</Label>
                                    <Input id="companyName" placeholder="Empresa alvo" {...form.register("companyName")} />
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="tone">Tom</Label>
                                    <Input id="tone" {...form.register("tone")} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="language">Idioma</Label>
                                    <Input id="language" {...form.register("language")} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="promptId">Prompt (opcional)</Label>
                                <Input id="promptId" placeholder="ID do prompt" {...form.register("promptId")} />
                                {promptsQuery.data && promptsQuery.data.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Prompts disponiveis:{" "}
                                        {promptsQuery.data
                                            .slice(0, 3)
                                            .map((prompt) => `${prompt.name} (${prompt.id})`)
                                            .join(" | ")}
                                    </p>
                                )}
                                {promptsQuery.isError && (
                                    <p className="text-xs text-destructive">
                                        Falha ao carregar prompts: {getErrorMessage(promptsQuery.error)}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="context">Contexto</Label>
                                <Textarea
                                    id="context"
                                    rows={4}
                                    placeholder="Contexto da negociacao, dor, oferta..."
                                    {...form.register("context")}
                                />
                            </div>

                            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                                {generateMutation.isPending ? "Gerando..." : "Gerar Mensagem"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Analise de Conversa</CardTitle>
                            <CardDescription>Intent e sentiment sobre a mesma mensagem.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="analysisText">Mensagem</Label>
                                <Textarea id="analysisText" rows={7} {...form.register("analysisText")} />
                            </div>
                            <Button
                                onClick={runAnalysis}
                                disabled={intentMutation.isPending || sentimentMutation.isPending}
                            >
                                {intentMutation.isPending || sentimentMutation.isPending
                                    ? "Analisando..."
                                    : "Analisar Intent + Sentiment"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Variantes Geradas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {generatedVariants.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhuma variante gerada ainda.</p>
                            ) : (
                                generatedVariants.map((variant, index) => (
                                    <div key={index} className="rounded-md border p-3">
                                        {variant.subject && (
                                            <p className="mb-2 text-sm font-semibold">{variant.subject}</p>
                                        )}
                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                            {variant.body || variant.message || "-"}
                                        </p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Resultado da Analise</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-md border bg-muted/40 p-3">
                                <p className="mb-2 text-sm font-semibold">Intent</p>
                                <pre className="text-xs whitespace-pre-wrap">
                                    {intentMutation.data
                                        ? JSON.stringify(intentMutation.data, null, 2)
                                        : "Sem analise ainda"}
                                </pre>
                            </div>
                            <div className="rounded-md border bg-muted/40 p-3">
                                <p className="mb-2 text-sm font-semibold">Sentiment</p>
                                <pre className="text-xs whitespace-pre-wrap">
                                    {sentimentMutation.data
                                        ? JSON.stringify(sentimentMutation.data, null, 2)
                                        : "Sem analise ainda"}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { distributionApi } from "@/lib/distribution-api";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-utils";

const QUICK_CHART_PATTERN = /https:\/\/quickchart\.io\/chart\?[^)\s]+/i;

const editDraftSchema = z.object({
    editedContent: z.string().min(1, "Conteudo nao pode ficar vazio"),
    platform: z.string().optional(),
});

const trackSchema = z.object({
    impressions: z.coerce.number().int().min(0),
    engagement: z.coerce.number().int().min(0),
});

type EditDraftValues = z.infer<typeof editDraftSchema>;
type TrackFormInput = z.input<typeof trackSchema>;
type TrackValues = z.output<typeof trackSchema>;

function extractQuickChartUrl(content: string) {
    const match = content.match(QUICK_CHART_PATTERN);
    return match?.[0] || null;
}

export default function DistributionDraftDetailsPage() {
    const params = useParams<{ id: string | string[] }>();
    const draftId = Array.isArray(params.id) ? params.id[0] : params.id;
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const draftQuery = useQuery({
        queryKey: ["distribution", "draft", draftId],
        queryFn: () => distributionApi.getById(draftId),
        enabled: Boolean(draftId),
    });

    const chartExportQuery = useQuery({
        queryKey: ["distribution", "draft-export", draftId],
        queryFn: () => distributionApi.exportChart(draftId),
        enabled: Boolean(draftId) && draftQuery.data?.format === "CHART",
    });

    const draft = draftQuery.data;

    const editForm = useForm<EditDraftValues>({
        resolver: zodResolver(editDraftSchema),
        values: {
            editedContent: draft?.editedContent || draft?.content || "",
            platform: draft?.platform || "",
        },
    });

    const trackForm = useForm<TrackFormInput, unknown, TrackValues>({
        resolver: zodResolver(trackSchema),
        values: {
            impressions: draft?.impressions ?? 0,
            engagement: draft?.engagement ?? 0,
        },
    });
    const watchedEditedContent = useWatch({
        control: editForm.control,
        name: "editedContent",
    });

    const updateMutation = useMutation({
        mutationFn: (input: EditDraftValues) =>
            distributionApi.update(draftId, {
                editedContent: input.editedContent,
                status: "APPROVED",
                platform: input.platform || undefined,
            }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["distribution", "draft", draftId] }),
                queryClient.invalidateQueries({ queryKey: ["distribution", "drafts"] }),
            ]);
            toast({ title: "Draft atualizado com sucesso" });
        },
        onError: (error) => {
            toast({
                title: "Erro ao atualizar draft",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const publishMutation = useMutation({
        mutationFn: (input: EditDraftValues) =>
            distributionApi.publish(draftId, {
                platform: input.platform || undefined,
            }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["distribution", "draft", draftId] }),
                queryClient.invalidateQueries({ queryKey: ["distribution", "drafts"] }),
            ]);
            toast({ title: "Draft publicado com sucesso" });
        },
        onError: (error) => {
            toast({
                title: "Erro ao publicar draft",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const trackMutation = useMutation({
        mutationFn: (input: TrackValues) => distributionApi.track(draftId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["distribution", "draft", draftId] });
            toast({ title: "Metricas atualizadas" });
        },
        onError: (error) => {
            toast({
                title: "Erro ao atualizar metricas",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const onSaveDraft = editForm.handleSubmit((values) => updateMutation.mutate(values));
    const onPublish = editForm.handleSubmit((values) => publishMutation.mutate(values));
    const onTrack = trackForm.handleSubmit((values) => trackMutation.mutate(values));

    if (draftQuery.isError) {
        return (
            <AppLayout>
                <div className="p-8 text-sm text-destructive">
                    Falha ao carregar draft: {getErrorMessage(draftQuery.error)}
                </div>
            </AppLayout>
        );
    }

    if (!draft) {
        return (
            <AppLayout>
                <div className="p-8 text-muted-foreground">Carregando draft...</div>
            </AppLayout>
        );
    }

    const currentEditedContent = watchedEditedContent || draft.content;
    const chartPreviewUrl =
        chartExportQuery.data?.url || extractQuickChartUrl(currentEditedContent);

    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Draft {draft.id}</h1>
                    <p className="text-muted-foreground">
                        Formato {draft.format} - Status {draft.status}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Edicao e aprovacao</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Textarea rows={12} {...editForm.register("editedContent")} />
                        {editForm.formState.errors.editedContent && (
                            <p className="text-xs text-destructive">
                                {editForm.formState.errors.editedContent.message}
                            </p>
                        )}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Input
                                placeholder="Plataforma (twitter/linkedin/manual)"
                                {...editForm.register("platform")}
                            />
                            <Button onClick={onSaveDraft} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? "Salvando..." : "Salvar e aprovar"}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={onPublish}
                                disabled={publishMutation.isPending}
                            >
                                {publishMutation.isPending ? "Publicando..." : "Publicar"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {draft.format === "CHART" && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Preview e export</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {chartPreviewUrl ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={chartPreviewUrl}
                                        alt="Chart preview"
                                        className="w-full rounded border"
                                    />
                                    <Button asChild variant="outline">
                                        <a
                                            href={chartPreviewUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            download={chartExportQuery.data?.filename || `${draft.id}.png`}
                                        >
                                            Exportar PNG
                                        </a>
                                    </Button>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nenhuma URL de imagem encontrada para este chart.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Tracking</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Input type="number" min={0} {...trackForm.register("impressions")} />
                            <Input type="number" min={0} {...trackForm.register("engagement")} />
                        </div>
                        <Button onClick={onTrack} disabled={trackMutation.isPending}>
                            {trackMutation.isPending ? "Atualizando..." : "Atualizar metricas"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

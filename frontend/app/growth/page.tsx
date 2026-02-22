"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { distributionApi } from "@/lib/distribution-api";
import { growthApi } from "@/lib/growth-api";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-utils";

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    if (status === "SUCCESS") {
        return "default";
    }
    if (status === "FAILED") {
        return "destructive";
    }
    if (status === "PROCESSING") {
        return "secondary";
    }
    return "outline";
}

export default function GrowthPage() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const oauthQuery = useMemo(() => {
        if (typeof window === "undefined") {
            return {
                provider: null as string | null,
                status: null as string | null,
                message: null as string | null,
            };
        }
        const params = new URLSearchParams(window.location.search);
        return {
            provider: params.get("oauth"),
            status: params.get("status"),
            message: params.get("message"),
        };
    }, []);

    const oauthProvider = oauthQuery.provider;
    const oauthStatus = oauthQuery.status;
    const oauthMessage = oauthQuery.message;

    const oauthFeedback = useMemo(() => {
        if (!oauthProvider || !oauthStatus) {
            return null;
        }

        if (oauthStatus === "connected") {
            return {
                type: "success" as const,
                text: `${oauthProvider.toUpperCase()} conectado com sucesso`,
            };
        }

        return {
            type: "error" as const,
            text: oauthMessage || `Falha ao conectar ${oauthProvider.toUpperCase()}`,
        };
    }, [oauthMessage, oauthProvider, oauthStatus]);

    const statusQuery = useQuery({
        queryKey: ["growth", "integration-status"],
        queryFn: () => growthApi.getIntegrationStatus(),
        refetchInterval: 15000,
    });

    const draftsQuery = useQuery({
        queryKey: ["growth", "drafts"],
        queryFn: () => distributionApi.list({ page: 1, limit: 20, status: "APPROVED" }),
    });

    const jobsQuery = useQuery({
        queryKey: ["growth", "publish-jobs"],
        queryFn: () => growthApi.listPublishJobs({ page: 1, limit: 30 }),
        refetchInterval: 8000,
    });

    const connectTwitterMutation = useMutation({
        mutationFn: () => growthApi.startTwitterOAuth("/growth"),
        onSuccess: (data) => {
            window.location.href = data.authorizationUrl;
        },
        onError: (error) => {
            toast({
                title: "Falha ao iniciar OAuth do Twitter",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const connectLinkedinMutation = useMutation({
        mutationFn: () => growthApi.startLinkedinOAuth("/growth"),
        onSuccess: (data) => {
            window.location.href = data.authorizationUrl;
        },
        onError: (error) => {
            toast({
                title: "Falha ao iniciar OAuth do LinkedIn",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const disconnectTwitterMutation = useMutation({
        mutationFn: () => growthApi.disconnectTwitter(),
        onSuccess: async () => {
            toast({ title: "Twitter desconectado" });
            await queryClient.invalidateQueries({ queryKey: ["growth"] });
        },
        onError: (error) => {
            toast({
                title: "Falha ao desconectar Twitter",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const disconnectLinkedinMutation = useMutation({
        mutationFn: () => growthApi.disconnectLinkedin(),
        onSuccess: async () => {
            toast({ title: "LinkedIn desconectado" });
            await queryClient.invalidateQueries({ queryKey: ["growth"] });
        },
        onError: (error) => {
            toast({
                title: "Falha ao desconectar LinkedIn",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const publishTwitterMutation = useMutation({
        mutationFn: (input: { content: string; draftId?: string }) => growthApi.publishTwitter(input),
        onSuccess: async () => {
            toast({ title: "Publicacao no Twitter enfileirada" });
            await queryClient.invalidateQueries({ queryKey: ["growth", "publish-jobs"] });
            await queryClient.invalidateQueries({ queryKey: ["growth", "integration-status"] });
        },
        onError: (error) => {
            toast({
                title: "Falha ao enfileirar Twitter",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const publishLinkedinMutation = useMutation({
        mutationFn: (input: { content: string; draftId?: string }) => growthApi.publishLinkedin(input),
        onSuccess: async () => {
            toast({ title: "Publicacao no LinkedIn enfileirada" });
            await queryClient.invalidateQueries({ queryKey: ["growth", "publish-jobs"] });
            await queryClient.invalidateQueries({ queryKey: ["growth", "integration-status"] });
        },
        onError: (error) => {
            toast({
                title: "Falha ao enfileirar LinkedIn",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const retryMutation = useMutation({
        mutationFn: (jobId: string) => growthApi.retryPublishJob(jobId),
        onSuccess: async () => {
            toast({ title: "Job reenfileirado" });
            await queryClient.invalidateQueries({ queryKey: ["growth", "publish-jobs"] });
        },
        onError: (error) => {
            toast({
                title: "Falha ao reenfileirar job",
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const approvedDrafts = draftsQuery.data?.items || [];
    const publishJobs = jobsQuery.data?.items || [];

    return (
        <AppLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Growth Loop</h1>
                    <p className="text-muted-foreground">
                        Conecte contas via OAuth e publique drafts com fila resiliente e retry automatico.
                    </p>
                </div>

                {oauthFeedback && (
                    <div
                        className={`rounded-md border p-3 text-sm ${
                            oauthFeedback.type === "success"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-destructive/40 bg-destructive/5 text-destructive"
                        }`}
                    >
                        {oauthFeedback.text}
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Twitter/X</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <p>
                                Status:{" "}
                                {statusQuery.data?.twitter.connected ? "Conectado" : "Nao conectado"}
                            </p>
                            {statusQuery.data?.twitter.expiresAt && (
                                <p className="text-muted-foreground">
                                    Expira em:{" "}
                                    {new Date(statusQuery.data.twitter.expiresAt).toLocaleString()}
                                </p>
                            )}
                            <div className="flex gap-2">
                                {statusQuery.data?.twitter.connected ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => disconnectTwitterMutation.mutate()}
                                        disabled={disconnectTwitterMutation.isPending}
                                    >
                                        Desconectar
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => connectTwitterMutation.mutate()}
                                        disabled={connectTwitterMutation.isPending}
                                    >
                                        Conectar via OAuth
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>LinkedIn</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <p>
                                Status:{" "}
                                {statusQuery.data?.linkedin.connected ? "Conectado" : "Nao conectado"}
                            </p>
                            {statusQuery.data?.linkedin.expiresAt && (
                                <p className="text-muted-foreground">
                                    Expira em:{" "}
                                    {new Date(statusQuery.data.linkedin.expiresAt).toLocaleString()}
                                </p>
                            )}
                            <div className="flex gap-2">
                                {statusQuery.data?.linkedin.connected ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => disconnectLinkedinMutation.mutate()}
                                        disabled={disconnectLinkedinMutation.isPending}
                                    >
                                        Desconectar
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => connectLinkedinMutation.mutate()}
                                        disabled={connectLinkedinMutation.isPending}
                                    >
                                        Conectar via OAuth
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Fila de Publicacao</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm md:grid-cols-4">
                        <div className="rounded border p-3">
                            <p className="text-muted-foreground">Queued</p>
                            <p className="text-xl font-semibold">{statusQuery.data?.publishQueue.queued || 0}</p>
                        </div>
                        <div className="rounded border p-3">
                            <p className="text-muted-foreground">Processing</p>
                            <p className="text-xl font-semibold">{statusQuery.data?.publishQueue.processing || 0}</p>
                        </div>
                        <div className="rounded border p-3">
                            <p className="text-muted-foreground">Failed</p>
                            <p className="text-xl font-semibold">{statusQuery.data?.publishQueue.failed || 0}</p>
                        </div>
                        <div className="rounded border p-3">
                            <p className="text-muted-foreground">Success</p>
                            <p className="text-xl font-semibold">{statusQuery.data?.publishQueue.success || 0}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Publicacao rapida</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {approvedDrafts.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Nenhum draft aprovado no momento.
                            </p>
                        )}
                        {approvedDrafts.map((draft) => {
                            const content = draft.editedContent || draft.content;
                            return (
                                <div key={draft.id} className="space-y-2 rounded border p-3">
                                    <p className="text-xs text-muted-foreground">
                                        {draft.format} - {draft.id}
                                    </p>
                                    <Input readOnly value={content.slice(0, 220)} />
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                publishTwitterMutation.mutate({ draftId: draft.id, content })
                                            }
                                            disabled={
                                                publishTwitterMutation.isPending ||
                                                !statusQuery.data?.twitter.connected
                                            }
                                        >
                                            Enfileirar no Twitter
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                publishLinkedinMutation.mutate({ draftId: draft.id, content })
                                            }
                                            disabled={
                                                publishLinkedinMutation.isPending ||
                                                !statusQuery.data?.linkedin.connected
                                            }
                                        >
                                            Enfileirar no LinkedIn
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Historico de Jobs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {publishJobs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sem jobs de publicacao.</p>
                        ) : (
                            publishJobs.map((job) => (
                                <div key={job.id} className="rounded border p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">
                                                {job.platform} - {job.id}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Tentativas: {job.attempts}/{job.maxAttempts}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={statusBadgeVariant(job.status)}>{job.status}</Badge>
                                            {job.status === "FAILED" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => retryMutation.mutate(job.id)}
                                                    disabled={retryMutation.isPending}
                                                >
                                                    Reenfileirar
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {job.errorMessage && (
                                        <p className="mt-2 text-xs text-destructive">{job.errorMessage}</p>
                                    )}
                                    {job.externalPostId && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Post ID: {job.externalPostId}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

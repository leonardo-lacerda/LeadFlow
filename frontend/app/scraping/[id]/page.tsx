"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    IconArrowLeft,
    IconRefresh,
    IconPlayerPlay,
    IconX,
    IconAlertCircle,
    IconCheck,
    IconClock,
    IconCode,
    IconBug,
    IconUsers,
    IconEye,
    IconSearch,
} from "@tabler/icons-react";
import { scrapingApi, ScrapingJob, ScrapingJobLead } from "@/lib/scraping-api";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type StatusIcon = ComponentType<{ className?: string }>;
const STATUS_CONFIG: Record<
    ScrapingJob["status"],
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: StatusIcon }
> = {
    PENDING: { label: "Pendente", variant: "secondary", icon: IconClock },
    RUNNING: { label: "Em Execução", variant: "default", icon: IconPlayerPlay },
    COMPLETED: { label: "Concluído", variant: "outline", icon: IconCheck },
    FAILED: { label: "Falhou", variant: "destructive", icon: IconX },
    CANCELLED: { label: "Cancelado", variant: "outline", icon: IconX },
};

export default function ScrapingJobDetails() {
    const params = useParams<{ id: string | string[] }>();
    const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();
    const { toast } = useToast();
    const [job, setJob] = useState<ScrapingJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<ScrapingJobLead[]>([]);
    const [leadsLoading, setLeadsLoading] = useState(true);
    const [leadsPage, setLeadsPage] = useState(1);
    const [leadsTotalPages, setLeadsTotalPages] = useState(1);
    const [leadsSearch, setLeadsSearch] = useState("");
    const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
    const leadsPageSize = 20;
    const [rerunning, setRerunning] = useState(false);
    const [showRerunDialog, setShowRerunDialog] = useState(false);
    const [rerunCooldownUntil, setRerunCooldownUntil] = useState<number | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const cooldownSeconds = 60;

    const loadJob = useCallback(async () => {
        if (!jobId) {
            return;
        }
        try {
            const data = await scrapingApi.getJob(jobId);
            setJob(data);
            setLastRefreshAt(new Date());
        } catch (error) {
            console.error("Failed to load job", error);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    const loadLeads = useCallback(async () => {
        if (!jobId) {
            return;
        }
        try {
            setLeadsLoading(true);
            const data = await scrapingApi.listJobLeads(jobId, {
                page: leadsPage,
                limit: leadsPageSize,
                search: leadsSearch || undefined,
            });
            setLeads(data.leads);
            setLeadsTotalPages(data.totalPages || 1);
            setLastRefreshAt(new Date());
        } catch (error) {
            console.error("Failed to load job leads", error);
        } finally {
            setLeadsLoading(false);
        }
    }, [jobId, leadsPage, leadsPageSize, leadsSearch]);

    const handleRerun = async () => {
        if (!job || job.status === "RUNNING" || cooldownRemaining > 0) {
            return;
        }
        setRerunning(true);
        try {
            await scrapingApi.rerunJob(job.id);
            toast({ title: "Job reexecutado com sucesso!" });
            setLeadsPage(1);
            loadJob();
            loadLeads();
            setRerunCooldownUntil(Date.now() + cooldownSeconds * 1000);
            setCooldownRemaining(cooldownSeconds);
        } catch (error) {
            toast({
                title: "Erro ao reexecutar job",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setRerunning(false);
        }
    };

    useEffect(() => {
        if (!rerunCooldownUntil) {
            setCooldownRemaining(0);
            return;
        }

        const updateRemaining = () => {
            const remaining = Math.max(
                0,
                Math.ceil((rerunCooldownUntil - Date.now()) / 1000)
            );
            setCooldownRemaining(remaining);
            if (remaining === 0) {
                setRerunCooldownUntil(null);
            }
        };

        updateRemaining();
        const interval = setInterval(updateRemaining, 1000);
        return () => clearInterval(interval);
    }, [rerunCooldownUntil]);

    useEffect(() => {
        loadJob();
        loadLeads();
        const interval = setInterval(() => {
            loadJob();
            loadLeads();
        }, 2000); // Refresh every 2s
        return () => clearInterval(interval);
    }, [loadJob, loadLeads]);

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Carregando...</p>
                </div>
            </AppLayout>
        );
    }

    if (!job) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <IconAlertCircle className="h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">Job de discovery nao encontrado</p>
                    <Button onClick={() => router.push("/scraping")}>Voltar</Button>
                </div>
            </AppLayout>
        );
    }

    const config = STATUS_CONFIG[job.status];
    const Icon = config.icon;

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/scraping")}
                        >
                            <IconArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-3xl font-bold">{job.name}</h1>
                                <Badge variant={config.variant} className="gap-1">
                                    <Icon className="h-3 w-3" />
                                    {config.label}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground">
                                Fonte: {job.source} • Criado{" "}
                                {formatDistanceToNow(new Date(job.createdAt), {
                                    addSuffix: true,
                                    locale: ptBR,
                                })}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={loadJob}>
                            <IconRefresh className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            disabled={job.status === "RUNNING" || rerunning || cooldownRemaining > 0}
                            onClick={() => setShowRerunDialog(true)}
                        >
                            <IconPlayerPlay className="mr-2 h-4 w-4" />
                            {rerunning
                                ? "Reexecutando..."
                                : cooldownRemaining > 0
                                  ? `Aguarde ${cooldownRemaining}s`
                                  : "Reexecutar"}
                        </Button>
                    </div>
                </div>

                <Dialog open={showRerunDialog} onOpenChange={setShowRerunDialog}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Reexecutar job?</DialogTitle>
                            <DialogDescription>
                                Isso vai disparar um novo ciclo de discovery para esta fonte e pode consumir recursos.
                                Aguarde {cooldownSeconds}s entre reexecucoes.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowRerunDialog(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={async () => {
                                    setShowRerunDialog(false);
                                    await handleRerun();
                                }}
                                disabled={rerunning || job.status === "RUNNING" || cooldownRemaining > 0}
                            >
                                {rerunning
                                    ? "Reexecutando..."
                                    : cooldownRemaining > 0
                                      ? `Aguarde ${cooldownRemaining}s`
                                      : "Confirmar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Progress Section */}
                {(job.status === "RUNNING" || job.progress > 0) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Progresso</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        {job.processedItems} de {job.totalItems || "?"} itens processados
                                    </span>
                                    <span className="font-medium">{job.progress}%</span>
                                </div>
                                <Progress value={job.progress} className="h-2" />
                            </div>
                            {job.status === "RUNNING" && (
                                <p className="text-sm text-muted-foreground">
                                    Discovery em andamento. Os prospects aparecem automaticamente abaixo.
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Atualizacao automatica a cada 2 segundos
                                {lastRefreshAt ? ` - ultima em ${lastRefreshAt.toLocaleTimeString("pt-BR")}` : ""}.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {job.status === "RUNNING" && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Captura Em Tempo Real</CardTitle>
                            <CardDescription>
                                Prospects mais recentes encontrados neste job.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-emerald-700">
                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Processo ativo
                            </div>
                            {leadsLoading ? (
                                <p className="text-sm text-muted-foreground">Atualizando prospects...</p>
                            ) : leads.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Ainda sem prospects capturados. Continue acompanhando.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {leads.slice(0, 5).map((lead) => (
                                        <div
                                            key={lead.id}
                                            className="flex items-center justify-between rounded border p-2 text-sm"
                                        >
                                            <span className="font-medium">
                                                {lead.fullName || lead.companyName || "Prospect sem nome"}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {lead.companyName || lead.city || "-"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <IconUsers className="h-4 w-4 text-muted-foreground" />
                                <CardDescription>Prospects Criados</CardDescription>
                            </div>
                            <CardTitle className="text-3xl">{job.leadsCreated}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <IconCheck className="h-4 w-4 text-muted-foreground" />
                                <CardDescription>Itens Processados</CardDescription>
                            </div>
                            <CardTitle className="text-3xl">{job.processedItems}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <IconClock className="h-4 w-4 text-muted-foreground" />
                                <CardDescription>Total de Itens</CardDescription>
                            </div>
                            <CardTitle className="text-3xl">{job.totalItems || "-"}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {/* Query Configuration */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <IconCode className="h-5 w-5" />
                            <CardTitle>Configuração da Query</CardTitle>
                        </div>
                        <CardDescription>Parâmetros utilizados neste job</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-64 w-full rounded-md border bg-muted/40">
                            <pre className="p-4 text-xs font-mono">
                                {JSON.stringify(job.query, null, 2)}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Prospects Captured */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>Prospects Capturados</CardTitle>
                                <CardDescription>Prospects gerados por este job</CardDescription>
                            </div>
                            <div className="w-full sm:max-w-xs">
                                <div className="relative">
                                    <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar prospect..."
                                        className="pl-9"
                                        value={leadsSearch}
                                        onChange={(event) => {
                                            setLeadsSearch(event.target.value);
                                            setLeadsPage(1);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Rede/Mapa</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Criado</TableHead>
                                    <TableHead className="text-right">Acoes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leadsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            Carregando prospects...
                                        </TableCell>
                                    </TableRow>
                                ) : leads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            Nenhum prospect associado a este job.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    leads.map((lead) => (
                                        <TableRow key={lead.id}>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {lead.fullName || "Prospect"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {lead.email || "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{lead.companyName || "-"}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {[lead.city, lead.state].filter(Boolean).join(", ") || "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{lead.phone || lead.whatsapp || "-"}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {lead.email || "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 text-xs">
                                                    {lead.linkedinUrl ? (
                                                        <a
                                                            href={lead.linkedinUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-primary hover:underline"
                                                        >
                                                            LinkedIn
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground">LinkedIn: -</span>
                                                    )}
                                                    {lead.sourceUrl ? (
                                                        <a
                                                            href={lead.sourceUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-primary hover:underline"
                                                        >
                                                            {/(maps\.google|google\.[^/]+\/maps|openstreetmap\.org)/i.test(
                                                                lead.sourceUrl
                                                            )
                                                                ? "Abrir mapa"
                                                                : "Abrir fonte"}
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground">Mapa: -</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{lead.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDistanceToNow(new Date(lead.createdAt), {
                                                    addSuffix: true,
                                                    locale: ptBR,
                                                })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.push(`/leads/${lead.id}`)}
                                                >
                                                    <IconEye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLeadsPage((page) => Math.max(1, page - 1))}
                                disabled={leadsPage <= 1 || leadsLoading}
                            >
                                Anterior
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                Pagina {leadsPage} de {Math.max(1, leadsTotalPages)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLeadsPage((page) => page + 1)}
                                disabled={leadsPage >= leadsTotalPages || leadsLoading}
                            >
                                Proximo
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Error Log */}
                {job.errors && Object.keys(job.errors).length > 0 && (
                    <Card className="border-destructive">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <IconBug className="h-5 w-5 text-destructive" />
                                <CardTitle className="text-destructive">Log de Erros</CardTitle>
                            </div>
                            <CardDescription>
                                Erros encontrados durante a execução
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-48 w-full rounded-md border bg-destructive/5">
                                <pre className="p-4 text-xs font-mono text-destructive">
                                    {JSON.stringify(job.errors, null, 2)}
                                </pre>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}

                {/* Timeline / Metadata */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">ID do Job</span>
                            <span className="font-mono">{job.id}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Criado em</span>
                            <span>{new Date(job.createdAt).toLocaleString("pt-BR")}</span>
                        </div>
                        {job.lastRunAt && (
                            <>
                                <Separator />
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Última execução</span>
                                    <span>{new Date(job.lastRunAt).toLocaleString("pt-BR")}</span>
                                </div>
                            </>
                        )}
                        {job.schedule && (
                            <>
                                <Separator />
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Agendamento (cron)</span>
                                    <span className="font-mono">{job.schedule}</span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}


"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconRefresh, IconSparkles } from "@tabler/icons-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    SignalRecordStatus,
    SignalRecordType,
    signalsApi,
} from "@/lib/signals-api";
import { networkApi } from "@/lib/network-api";
import { NetworkBadge } from "@/components/signals/network-badge";

const TYPE_OPTIONS: Array<{ value: SignalRecordType; label: string }> = [
    { value: "TIMING", label: "Timing" },
    { value: "CHANNEL", label: "Canal" },
    { value: "ICP", label: "ICP" },
    { value: "MESSAGE", label: "Mensagem" },
    { value: "OBJECTION", label: "Objecao" },
    { value: "CONVERSION", label: "Conversao" },
];

const STATUS_OPTIONS: Array<{ value: SignalRecordStatus; label: string }> = [
    { value: "NEW", label: "Novo" },
    { value: "SEEN", label: "Visto" },
    { value: "USED", label: "Usado" },
    { value: "DISMISSED", label: "Descartado" },
];

function statusBadgeVariant(status: SignalRecordStatus): "default" | "secondary" | "outline" {
    if (status === "USED") {
        return "default";
    }
    if (status === "SEEN") {
        return "secondary";
    }
    return "outline";
}

export default function SignalsPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [typeFilter, setTypeFilter] = useState<"ALL" | SignalRecordType>("ALL");
    const [statusFilter, setStatusFilter] = useState<"ALL" | SignalRecordStatus>("ALL");
    const [minConfidence, setMinConfidence] = useState("55");

    const parsedMinConfidence = useMemo(() => {
        const parsed = Number(minConfidence);
        if (Number.isNaN(parsed)) {
            return undefined;
        }
        return Math.max(0, Math.min(100, Math.round(parsed)));
    }, [minConfidence]);

    const listQuery = useQuery({
        queryKey: ["signals", "records", page, typeFilter, statusFilter, parsedMinConfidence],
        queryFn: () =>
            signalsApi.listSignals({
                page,
                limit: 12,
                type: typeFilter === "ALL" ? undefined : typeFilter,
                status: statusFilter === "ALL" ? undefined : statusFilter,
                minConfidence: parsedMinConfidence,
            }),
    });

    const summaryQuery = useQuery({
        queryKey: ["signals", "summary"],
        queryFn: () => signalsApi.getSignalSummary(),
    });

    const networkSignalsQuery = useQuery({
        queryKey: ["network", "signals", "signals-page"],
        queryFn: () => networkApi.getSignals({ windowDays: 30 }),
    });

    const detectMutation = useMutation({
        mutationFn: () =>
            signalsApi.runDetection({
                async: false,
                minConfidence: parsedMinConfidence,
            }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["signals", "records"] }),
                queryClient.invalidateQueries({ queryKey: ["signals", "summary"] }),
            ]);
        },
    });

    const statusMutation = useMutation({
        mutationFn: (input: { signalId: string; status: SignalRecordStatus }) =>
            signalsApi.updateSignalStatus(input.signalId, input.status),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["signals", "records"] }),
                queryClient.invalidateQueries({ queryKey: ["signals", "summary"] }),
            ]);
        },
    });

    const signals = listQuery.data?.items || [];
    const meta = listQuery.data?.meta;

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Signal Engine</h1>
                        <p className="text-muted-foreground">
                            Insights detectados automaticamente a partir de mensagens, campanhas e conversoes.
                        </p>
                    </div>
                    <NetworkBadge organizations={networkSignalsQuery.data?.activeOrganizations || 0} />
                    <Button onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending}>
                        <IconRefresh className="mr-2 h-4 w-4" />
                        {detectMutation.isPending ? "Detectando..." : "Detectar agora"}
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Sinais ativos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{listQuery.data?.total || 0}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Ultima atualizacao</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">
                                {summaryQuery.data?.lastGeneratedAt
                                    ? formatDistanceToNow(new Date(summaryQuery.data.lastGeneratedAt), {
                                          addSuffix: true,
                                          locale: ptBR,
                                      })
                                    : "Sem execucao"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Tipos detectados</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            {(summaryQuery.data?.byType || []).map((entry) => (
                                <Badge key={entry.type} variant="outline">
                                    {entry.type}: {entry.count}
                                </Badge>
                            ))}
                            {(!summaryQuery.data || summaryQuery.data.byType.length === 0) && (
                                <p className="text-sm text-muted-foreground">Sem sinais ainda.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-4">
                        <Select
                            value={typeFilter}
                            onValueChange={(value) => {
                                setTypeFilter(value as "ALL" | SignalRecordType);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os tipos</SelectItem>
                                {TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                                setStatusFilter(value as "ALL" | SignalRecordStatus);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os status</SelectItem>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Input
                            type="number"
                            min={0}
                            max={100}
                            value={minConfidence}
                            onChange={(event) => {
                                setMinConfidence(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Confianca minima"
                        />

                        <Button
                            variant="outline"
                            onClick={() => {
                                queryClient.invalidateQueries({ queryKey: ["signals", "records"] });
                                queryClient.invalidateQueries({ queryKey: ["signals", "summary"] });
                            }}
                        >
                            <IconSparkles className="mr-2 h-4 w-4" />
                            Atualizar
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Insights detectados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Confianca</TableHead>
                                        <TableHead>Insight</TableHead>
                                        <TableHead>Dados</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Atualizado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {listQuery.isLoading && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                                                Carregando sinais...
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!listQuery.isLoading && signals.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                                                Nenhum sinal encontrado para os filtros atuais.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {signals.map((signal) => (
                                        <TableRow key={signal.id}>
                                            <TableCell className="font-medium">{signal.type}</TableCell>
                                            <TableCell>{signal.confidence}%</TableCell>
                                            <TableCell className="max-w-[500px] truncate">{signal.insight}</TableCell>
                                            <TableCell>{signal.dataPoints}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={statusBadgeVariant(signal.status)}>{signal.status}</Badge>
                                                    <Select
                                                        value={signal.status}
                                                        onValueChange={(value) =>
                                                            statusMutation.mutate({
                                                                signalId: signal.id,
                                                                status: value as SignalRecordStatus,
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 w-[130px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {STATUS_OPTIONS.map((option) => (
                                                                <SelectItem key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {formatDistanceToNow(new Date(signal.updatedAt), {
                                                    addSuffix: true,
                                                    locale: ptBR,
                                                })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {meta && meta.totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Pagina {meta.page} de {meta.totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                        disabled={page <= 1}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((prev) => prev + 1)}
                                        disabled={page >= meta.totalPages}
                                    >
                                        Proxima
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

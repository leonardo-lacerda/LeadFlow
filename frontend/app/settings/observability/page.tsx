"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { opsApi } from "@/lib/ops-api";

export default function ObservabilityPage() {
    const summaryQuery = useQuery({
        queryKey: ["ops", "summary"],
        queryFn: () => opsApi.getSummary(),
        refetchInterval: 10000,
    });

    const errorsQuery = useQuery({
        queryKey: ["ops", "errors"],
        queryFn: () => opsApi.getErrors(20),
        refetchInterval: 10000,
    });

    const summary = summaryQuery.data;
    const queueEntries = Object.entries(summary?.queues || {});

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Observabilidade</h3>
                <p className="text-sm text-muted-foreground">
                    Saude operacional das filas e workers em tempo real.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Alertas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {summaryQuery.isLoading && (
                        <p className="text-sm text-muted-foreground">Carregando alertas...</p>
                    )}
                    {!summaryQuery.isLoading && (summary?.alerts.length || 0) === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum alerta ativo.</p>
                    )}
                    {(summary?.alerts || []).map((alert, index) => (
                        <div key={`${alert.queue}-${index}`} className="rounded border p-3">
                            <div className="flex items-center gap-2">
                                <Badge variant={alert.level === "critical" ? "destructive" : "secondary"}>
                                    {alert.level.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{alert.queue}</span>
                            </div>
                            <p className="mt-1 text-sm">{alert.message}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Filas</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                    {queueEntries.length === 0 && (
                        <p className="text-sm text-muted-foreground">Sem dados de fila.</p>
                    )}
                    {queueEntries.map(([queueName, counts]) => (
                        <div key={queueName} className="rounded border p-3 space-y-1 text-sm">
                            <p className="font-medium">{queueName}</p>
                            <p className="text-muted-foreground">Waiting: {counts.waiting || 0}</p>
                            <p className="text-muted-foreground">Active: {counts.active || 0}</p>
                            <p className="text-muted-foreground">Failed: {counts.failed || 0}</p>
                            <p className="text-muted-foreground">Completed: {counts.completed || 0}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Workers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {(summary?.workers || []).map((worker) => (
                        <div key={`${worker.queueName}-${worker.workerName}`} className="rounded border p-3">
                            <p className="text-sm font-medium">
                                {worker.workerName} ({worker.queueName})
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Processados: {worker.processed} | Sucesso: {worker.completed} | Falha: {worker.failed} | Stalled: {worker.stalled}
                            </p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Erros recentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {errorsQuery.isLoading && (
                        <p className="text-sm text-muted-foreground">Carregando erros...</p>
                    )}
                    {!errorsQuery.isLoading && (errorsQuery.data?.length || 0) === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum erro recente.</p>
                    )}
                    {(errorsQuery.data || []).map((error, index) => (
                        <div key={`${error.timestamp}-${index}`} className="rounded border p-3">
                            <p className="text-sm font-medium">
                                {error.workerName} ({error.queueName})
                            </p>
                            <p className="mt-1 text-xs text-destructive">{error.message}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(error.timestamp).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

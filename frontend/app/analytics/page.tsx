"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { SourceChart } from "@/components/analytics/source-chart";
import { TimingHeatmap } from "@/components/analytics/timing-heatmap";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { ResponseTimeMetric } from "@/components/analytics/response-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { analyticsApi } from "@/lib/analytics-api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { IconRefresh } from "@tabler/icons-react";

function MetricCard(props: { label: string; value: string | number; helper?: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {props.label}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{props.value}</div>
                {props.helper ? <p className="text-xs text-muted-foreground">{props.helper}</p> : null}
            </CardContent>
        </Card>
    );
}

export default function AnalyticsPage() {
    const { data: stats } = useQuery({
        queryKey: ["analytics", "stats"],
        queryFn: () => analyticsApi.getStats(),
    });

    const { data: sourcePerformance } = useQuery({
        queryKey: ["analytics", "source-performance"],
        queryFn: () => analyticsApi.getSourcePerformance(),
    });

    const { data: messagePerformance } = useQuery({
        queryKey: ["analytics", "message-performance"],
        queryFn: () => analyticsApi.getMessagePerformance(),
    });

    const { data: heatmap } = useQuery({
        queryKey: ["analytics", "timing-heatmap"],
        queryFn: () => analyticsApi.getTimingHeatmap(),
    });

    const { data: responseTime } = useQuery({
        queryKey: ["analytics", "response-time"],
        queryFn: () => analyticsApi.getResponseTime(),
    });

    const { data: scoreCorrelation } = useQuery({
        queryKey: ["analytics", "score-correlation"],
        queryFn: () => analyticsApi.getScoreCorrelation(),
    });

    const { data: funnel } = useQuery({
        queryKey: ["analytics", "funnel"],
        queryFn: () => analyticsApi.getFunnel(),
    });

    const recalculateMutation = useMutation({
        mutationFn: () => analyticsApi.recalculate(),
    });

    const funnelStages = funnel?.stages || [];
    const captured = funnelStages.find((stage) => stage.id === "captured")?.value || 0;
    const replied = funnelStages.find((stage) => stage.id === "replied")?.value || 0;
    const converted = funnelStages.find((stage) => stage.id === "converted")?.value || 0;
    const conversionRate =
        captured > 0 ? `${((converted / captured) * 100).toFixed(1)}%` : "0%";

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Analytics Avancado</h1>
                        <p className="text-muted-foreground">
                            Correlacoes de desempenho para orientar decisao comercial.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => recalculateMutation.mutate()}
                        disabled={recalculateMutation.isPending}
                    >
                        <IconRefresh className="mr-2 h-4 w-4" />
                        Recalcular metricas
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Leads capturados"
                        value={captured}
                        helper={stats ? `Variacao mes: ${stats.changes.leads}` : undefined}
                    />
                    <MetricCard
                        label="Leads responderam"
                        value={replied}
                        helper={stats ? `Taxa de resposta: ${stats.responseRate}%` : undefined}
                    />
                    <MetricCard
                        label="Leads convertidos"
                        value={converted}
                        helper={`Conversao final: ${conversionRate}`}
                    />
                    <MetricCard
                        label="Tempo medio de resposta"
                        value={
                            responseTime
                                ? `${(responseTime.summary.avgSeconds / 3600).toFixed(2)}h`
                                : "0h"
                        }
                        helper={responseTime ? `${responseTime.summary.count} respostas` : undefined}
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <SourceChart items={sourcePerformance?.items || []} />
                    <FunnelChart stages={funnelStages} />
                </div>

                {heatmap ? <TimingHeatmap data={heatmap} /> : null}
                {responseTime ? <ResponseTimeMetric data={responseTime} /> : null}

                <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Mensagem x segmento</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Canal</TableHead>
                                            <TableHead>Template</TableHead>
                                            <TableHead>Segmento</TableHead>
                                            <TableHead>Envios</TableHead>
                                            <TableHead>Reply</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {messagePerformance?.items?.slice(0, 10).map((item) => (
                                            <TableRow
                                                key={`${item.channel}-${item.templateName}-${item.industry}`}
                                            >
                                                <TableCell>{item.channel}</TableCell>
                                                <TableCell>{item.templateName}</TableCell>
                                                <TableCell>{item.industry}</TableCell>
                                                <TableCell>{item.sent}</TableCell>
                                                <TableCell>{item.replyRate.toFixed(1)}%</TableCell>
                                            </TableRow>
                                        ))}
                                        {(!messagePerformance || messagePerformance.items.length === 0) && (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={5}
                                                    className="h-20 text-center text-muted-foreground"
                                                >
                                                    Sem dados de mensagem.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Score x conversao</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Faixa</TableHead>
                                            <TableHead>Leads</TableHead>
                                            <TableHead>Contatados</TableHead>
                                            <TableHead>Reply</TableHead>
                                            <TableHead>Conversao</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {scoreCorrelation?.items?.map((item) => (
                                            <TableRow key={item.bucket}>
                                                <TableCell>{item.bucket}</TableCell>
                                                <TableCell>{item.totalLeads}</TableCell>
                                                <TableCell>{item.contactedLeads}</TableCell>
                                                <TableCell>{item.replyRate.toFixed(1)}%</TableCell>
                                                <TableCell>{item.conversionRate.toFixed(1)}%</TableCell>
                                            </TableRow>
                                        ))}
                                        {(!scoreCorrelation || scoreCorrelation.items.length === 0) && (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={5}
                                                    className="h-20 text-center text-muted-foreground"
                                                >
                                                    Sem dados de score.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

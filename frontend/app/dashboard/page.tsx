"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsApi } from "@/lib/analytics-api";
import { signalsApi } from "@/lib/signals-api";
import { useQuery } from "@tanstack/react-query";
import {
    IconUsers,
    IconMail,
    IconBrandWhatsapp,
    IconChartBar,
    IconPlus,
    IconUpload,
    IconBulb,
    IconSettings,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { HotLeadsWidget } from "@/components/dashboard/hot-leads-widget";

export default function DashboardPage() {
    const [period, setPeriod] = useState("30d");

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["analytics", "stats"],
        queryFn: () => analyticsApi.getStats(),
    });

    const { data: activities, isLoading: activitiesLoading } = useQuery({
        queryKey: ["analytics", "recent-activity"],
        queryFn: () => analyticsApi.getRecentActivity(5),
    });

    const { data: signalsOverview } = useQuery({
        queryKey: ["signals", "overview", "dashboard"],
        queryFn: () => signalsApi.getOverview(),
    });

    const { data: signalAlerts } = useQuery({
        queryKey: ["signals", "alerts", "dashboard-page"],
        queryFn: () => signalsApi.getActionableAlerts(4),
    });

    const totalSent = (stats?.emailsSent || 0) + (stats?.whatsappSent || 0);
    const responseRateValue = Number(stats?.responseRate || 0);
    const signalHealthScore = Math.max(
        0,
        Math.min(99, Math.round(responseRateValue * 1.2 + Math.min(totalSent / 50, 40)))
    );
    const signalHealthDisplay = statsLoading ? "..." : `${signalHealthScore}/100`;
    const signalLiftHint = statsLoading
        ? "..."
        : `${Math.max(1.6, (responseRateValue || 15) / 5).toFixed(1)}x`;
    const preferredChannel =
        signalsOverview?.organization.topChannel === "whatsapp"
            ? "WhatsApp"
            : (stats?.whatsappSent || 0) >= (stats?.emailsSent || 0)
                ? "WhatsApp"
                : "Email";

    const statsCards = [
        {
            title: "Score de Saude de Sinais",
            value: signalHealthDisplay,
            change: statsLoading ? "..." : stats?.changes.responseRate || "+0%",
            icon: <IconChartBar className="h-4 w-4 text-muted-foreground" />,
        },
        {
            title: "Leads Mapeados",
            value: statsLoading ? "..." : stats?.totalLeads.toLocaleString() || "0",
            change: statsLoading ? "..." : stats?.changes.leads || "+0%",
            icon: <IconUsers className="h-4 w-4 text-muted-foreground" />,
        },
        {
            title: "Emails Enviados",
            value: statsLoading ? "..." : stats?.emailsSent.toLocaleString() || "0",
            change: statsLoading ? "..." : stats?.changes.emails || "+0%",
            icon: <IconMail className="h-4 w-4 text-muted-foreground" />,
        },
        {
            title: "Taxa de Resposta",
            value: statsLoading ? "..." : `${stats?.responseRate || "0"}%`,
            change: statsLoading ? "..." : stats?.changes.responseRate || "+0%",
            icon: <IconBrandWhatsapp className="h-4 w-4 text-muted-foreground" />,
        },
    ];

    const totalReplies =
        totalSent > 0 && stats?.responseRate
            ? Math.round((parseFloat(stats.responseRate) / 100) * totalSent)
            : 0;

    const funnelSteps = [
        { label: "Leads", value: stats?.totalLeads || 0 },
        { label: "Mensagens Enviadas", value: totalSent },
        { label: "Respostas", value: totalReplies },
    ];
    const maxFunnelValue = Math.max(...funnelSteps.map((s) => s.value), 1);

    const objectiveGroups = [
        {
            title: "Quer encontrar e organizar leads?",
            hint: "Monte e mantenha a base comercial ativa.",
            icon: <IconUsers className="h-4 w-4 text-muted-foreground" />,
            links: [
                { label: "Leads", href: "/leads" },
                { label: "Importar Leads", href: "/leads/import" },
                { label: "Descoberta de Leads", href: "/scraping" },
                { label: "Lead Pool", href: "/lead-pool" },
            ],
        },
        {
            title: "Quer executar outreach e responder rapido?",
            hint: "Dispare sequencias e centralize as respostas.",
            icon: <IconMail className="h-4 w-4 text-muted-foreground" />,
            links: [
                { label: "Sequencias", href: "/campaigns" },
                { label: "Caixa de entrada", href: "/inbox" },
            ],
        },
        {
            title: "Quer transformar dados em sinais e conteudo?",
            hint: "Analise, gere ativos e publique com contexto.",
            icon: <IconBulb className="h-4 w-4 text-muted-foreground" />,
            links: [
                { label: "Inteligencia", href: "/analytics" },
                { label: "Signal Engine", href: "/signals" },
                { label: "AI Workspace", href: "/ai" },
                { label: "Distribution", href: "/distribution" },
                { label: "Growth Loop", href: "/growth" },
            ],
        },
        {
            title: "Quer configurar o sistema?",
            hint: "Ajuste equipe, credenciais e integracoes.",
            icon: <IconSettings className="h-4 w-4 text-muted-foreground" />,
            links: [
                { label: "Configuracoes", href: "/settings" },
                { label: "Integracoes", href: "/settings/integrations" },
                { label: "Time", href: "/settings/team" },
            ],
        },
    ];

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Painel</h2>
                    <div className="flex items-center gap-3">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Periodo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7d">Ultimos 7 dias</SelectItem>
                                <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                                <SelectItem value="90d">Ultimos 90 dias</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button asChild>
                            <Link href="/campaigns/new">
                                <IconPlus className="mr-2 h-4 w-4" />
                                Nova Sequencia
                            </Link>
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Por onde voce quer comecar?</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Navegue por objetivo para chegar nas telas certas mais rapido.
                        </p>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                        {objectiveGroups.map((group) => (
                            <div key={group.title} className="rounded-md border p-4">
                                <div className="flex items-center gap-2">
                                    {group.icon}
                                    <p className="text-sm font-semibold">{group.title}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{group.hint}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {group.links.map((link) => (
                                        <Button key={link.href} variant="outline" size="sm" asChild>
                                            <Link href={link.href}>{link.label}</Link>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {statsCards.map((stat, index) => (
                        <motion.div
                            key={stat.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {stat.title}
                                    </CardTitle>
                                    {stat.icon}
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {stat.change} em relacao ao mes passado
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <HotLeadsWidget />

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Insight de sinais</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Seu ICP tecnico esta aproximadamente{" "}
                                <span className="font-semibold text-foreground">{signalLiftHint}</span>{" "}
                                mais responsivo nesta semana.
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Priorize sequencias para{" "}
                                {signalsOverview?.network.bestWindow
                                    ? `${signalsOverview.network.bestWindow.dayOfWeek} ${String(signalsOverview.network.bestWindow.hour).padStart(2, "0")}h`
                                    : "cargos de engenharia entre 9h e 11h"}
                                .
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Recomendacao de canal</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Com a performance atual, o canal dominante para esse segmento e{" "}
                                <span className="font-semibold text-foreground">{preferredChannel}</span>.
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Ajuste suas sequencias e acompanhe a variacao em Inteligencia.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {signalAlerts && signalAlerts.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Alertas Acionaveis</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-2">
                            {signalAlerts.map((alert) => (
                                <div key={alert.id} className="rounded-md border p-3">
                                    <p className="text-sm font-medium">{alert.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {alert.recommendedAction}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Funil de Conversa</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <div className="space-y-4">
                                {funnelSteps.map((step) => (
                                    <div key={step.label} className="flex items-center gap-4">
                                        <div className="w-32 text-sm text-muted-foreground">{step.label}</div>
                                        <div className="flex-1">
                                            <div className="h-3 rounded-full bg-muted">
                                                <div
                                                    className="h-3 rounded-full bg-primary transition-all"
                                                    style={{ width: `${(step.value / maxFunnelValue) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-16 text-right text-sm font-medium">
                                            {step.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="col-span-3">
                        <CardHeader>
                            <CardTitle>Atividade Recente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-8">
                                {activitiesLoading ? (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        Carregando atividades...
                                    </div>
                                ) : activities && activities.length > 0 ? (
                                    activities.map((activity) => (
                                        <div key={activity.id} className="flex items-center">
                                            <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                                                {activity.type === "email" ? (
                                                    <IconMail className="h-4 w-4" />
                                                ) : (
                                                    <IconBrandWhatsapp className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="ml-4 space-y-1 flex-1">
                                                <p className="text-sm font-medium leading-none">
                                                    {activity.description}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {activity.leadEmail || activity.leadName}
                                                </p>
                                            </div>
                                            <div className="ml-auto font-medium text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(activity.timestamp), {
                                                    addSuffix: true,
                                                    locale: ptBR,
                                                })}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                        Nenhuma atividade recente
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Acoes Rapidas</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        <Button variant="outline" asChild>
                            <Link href="/leads/import">
                                <IconUpload className="mr-2 h-4 w-4" />
                                Importar Leads
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/leads">
                                <IconPlus className="mr-2 h-4 w-4" />
                                Adicionar Lead
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/campaigns/new">
                                <IconPlus className="mr-2 h-4 w-4" />
                                Criar Sequencia
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}



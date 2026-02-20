"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsApi } from "@/lib/analytics-api";
import { useQuery } from "@tanstack/react-query";
import {
    IconUsers,
    IconMail,
    IconBrandWhatsapp,
    IconChartBar,
    IconPlus,
    IconUpload,
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
import { useState } from "react";
import { HotLeadsWidget } from "@/components/dashboard/hot-leads-widget";

export default function DashboardPage() {
    const [period, setPeriod] = useState("30d");

    // Fetch dashboard stats
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["analytics", "stats"],
        queryFn: () => analyticsApi.getStats(),
    });

    // Fetch recent activity
    const { data: activities, isLoading: activitiesLoading } = useQuery({
        queryKey: ["analytics", "recent-activity"],
        queryFn: () => analyticsApi.getRecentActivity(5),
    });

    const statsCards = [
        {
            title: "Total Leads",
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
            title: "WhatsApp Enviados",
            value: statsLoading ? "..." : stats?.whatsappSent.toLocaleString() || "0",
            change: statsLoading ? "..." : stats?.changes.whatsapp || "+0%",
            icon: <IconBrandWhatsapp className="h-4 w-4 text-muted-foreground" />,
        },
        {
            title: "Taxa de Resposta",
            value: statsLoading ? "..." : `${stats?.responseRate || "0"}%`,
            change: statsLoading ? "..." : stats?.changes.responseRate || "+0%",
            icon: <IconChartBar className="h-4 w-4 text-muted-foreground" />,
        },
    ];

    const totalSent = (stats?.emailsSent || 0) + (stats?.whatsappSent || 0);
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

    return (
        <AppLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <div className="flex items-center gap-3">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Período" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button asChild>
                            <Link href="/campaigns/new">
                                <IconPlus className="mr-2 h-4 w-4" />
                                Nova Campanha
                            </Link>
                        </Button>
                    </div>
                </div>

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
                                        {stat.change} em relação ao mês passado
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <HotLeadsWidget />

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Funil de Vendas</CardTitle>
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
                        <CardTitle>Ações Rápidas</CardTitle>
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
                                Criar Campanha
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

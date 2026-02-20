"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { IconArrowLeft, IconPlayerPlay, IconPlayerPause, IconEdit } from "@tabler/icons-react";
import { campaignsApi, Campaign } from "@/lib/campaigns-api";
import { useToast } from "@/hooks/use-toast";
import { CampaignLeadsTable } from "@/components/campaigns/campaign-leads-table";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";

export default function CampaignDetailsPage() {
    const params = useParams<{ id: string | string[] }>();
    const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();
    const { toast } = useToast();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);

    const loadCampaign = useCallback(async () => {
        if (!campaignId) {
            return;
        }
        try {
            setLoading(true);
            const data = await campaignsApi.getById(campaignId);
            setCampaign(data);
        } catch (error) {
            console.error("Error loading campaign:", error);
            toast({
                title: "Erro ao carregar campanha",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [campaignId, toast]);

    useEffect(() => {
        loadCampaign();
    }, [loadCampaign]);

    const { data: analytics } = useQuery({
        queryKey: ["campaign", campaignId, "analytics"],
        queryFn: () => campaignsApi.getAnalytics(campaignId as string),
        enabled: !!campaignId,
    });

    const handleStatusToggle = async () => {
        if (!campaign) return;

        try {
            const newStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
            await campaignsApi.updateStatus(
                campaign.id,
                newStatus as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED"
            );

            toast({
                title: "Status atualizado",
                description: `Campanha ${newStatus === "ACTIVE" ? "ativada" : "pausada"} com sucesso.`,
            });

            loadCampaign();
        } catch (error) {
            toast({
                title: "Erro ao atualizar status",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            });
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            DRAFT: "secondary",
            ACTIVE: "default",
            PAUSED: "outline",
            COMPLETED: "secondary",
        };

        return <Badge variant={variants[status] || "default"}>{status}</Badge>;
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-96">
                    <p>Carregando...</p>
                </div>
            </AppLayout>
        );
    }

    if (!campaign) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-96">
                    <p>Campanha não encontrada.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}>
                            <IconArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold">{campaign.name}</h1>
                                {getStatusBadge(campaign.status)}
                            </div>
                            <p className="text-muted-foreground">
                                Criada em {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/campaigns/${campaign.id}/edit`)}>
                            <IconEdit className="h-4 w-4 mr-2" />
                            Editar
                        </Button>
                        <Button
                            variant={campaign.status === "ACTIVE" ? "outline" : "default"}
                            size="sm"
                            onClick={handleStatusToggle}
                            disabled={campaign.status === "DRAFT"}
                        >
                            {campaign.status === "ACTIVE" ? (
                                <>
                                    <IconPlayerPause className="h-4 w-4 mr-2" />
                                    Pausar
                                </>
                            ) : (
                                <>
                                    <IconPlayerPlay className="h-4 w-4 mr-2" />
                                    Ativar
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="steps">Sequência</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="leads">Leads ({campaign.leads?.length || 0})</TabsTrigger>
                        <TabsTrigger value="journey">Jornada</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-6">
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{campaign.leads?.length || 0}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Enviados</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {campaign.leads?.filter((l) => l.status !== "PENDING").length || 0}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Respostas</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {campaign.leads?.filter((l) => l.status === "REPLIED").length || 0}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {campaign.leads && campaign.leads.length > 0
                                            ? (
                                                (campaign.leads.filter((l) => l.status === "REPLIED").length /
                                                    campaign.leads.length) *
                                                100
                                            ).toFixed(1)
                                            : 0}
                                        %
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="steps" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Sequência de Passos</CardTitle>
                                <CardDescription>
                                    Visualize a sequência de mensagens desta campanha
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {campaign.steps?.map((step, index) => (
                                        <div key={step.id} className="flex items-start gap-4 p-4 border rounded-lg">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline">{step.type}</Badge>
                                                    {step.delayHours > 0 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Aguarda {step.delayHours}h
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-medium">{step.subject || step.content.substring(0, 50)}</h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {step.content.substring(0, 100)}...
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-6">
                        <div className="grid gap-4 md:grid-cols-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Enviados</CardTitle>
                                </CardHeader>
                                <CardContent className="text-2xl font-bold">
                                    {analytics?.totals.sent ?? 0}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Entregues</CardTitle>
                                </CardHeader>
                                <CardContent className="text-2xl font-bold">
                                    {analytics?.totals.delivered ?? 0}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Abertos</CardTitle>
                                </CardHeader>
                                <CardContent className="text-2xl font-bold">
                                    {analytics?.totals.opened ?? 0}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Respondidos</CardTitle>
                                </CardHeader>
                                <CardContent className="text-2xl font-bold">
                                    {analytics?.totals.replied ?? 0}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="mt-6">
                            <CardHeader>
                                <CardTitle>Métricas por Passo</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {campaign.steps.map((step) => {
                                        const stats = analytics?.stepStats?.[step.id];
                                        return (
                                            <div key={step.id} className="border rounded-md p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{step.subject || step.content.slice(0, 40)}</span>
                                                    <Badge variant="outline">{step.type}</Badge>
                                                </div>
                                                <div className="grid grid-cols-4 gap-3 mt-2 text-sm text-muted-foreground">
                                                    <div>Enviados: {stats?.sent ?? 0}</div>
                                                    <div>Abertos: {stats?.opened ?? 0}</div>
                                                    <div>Respondidos: {stats?.replied ?? 0}</div>
                                                    <div>Cliques: {stats?.clicked ?? 0}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="leads" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Leads na Campanha</CardTitle>
                                <CardDescription>
                                    Acompanhe o progresso e status de cada lead
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <CampaignLeadsTable campaignId={campaign.id} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="journey" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Jornada dos Leads</CardTitle>
                                <CardDescription>
                                    Visualize o progresso dos leads na sequência.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {campaign.leads?.length ? (
                                    campaign.leads.map((lead) => {
                                        const totalSteps = Math.max(campaign.steps.length, 1);
                                        const progress = Math.min(100, ((lead.currentStep + 1) / totalSteps) * 100);
                                        return (
                                            <div key={lead.id} className="border rounded-md p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">{lead.lead?.fullName || "Lead"}</p>
                                                        <p className="text-xs text-muted-foreground">{lead.lead?.email}</p>
                                                    </div>
                                                    <Badge variant="outline">{lead.status}</Badge>
                                                </div>
                                                <div className="mt-3">
                                                    <Progress value={progress} />
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Passo {lead.currentStep + 1} de {totalSteps}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-muted-foreground">Nenhum lead associado.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

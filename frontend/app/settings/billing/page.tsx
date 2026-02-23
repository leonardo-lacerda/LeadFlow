"use client";

import { useEffect, useMemo, useState } from "react";
import { IconLoader } from "@tabler/icons-react";
import {
    billingApi,
    BillingCatalog,
    BillingUsage,
    BillingOverageResponse,
    PlanCode,
} from "@/lib/billing-api";
import { organizationApi, Organization } from "@/lib/organization-api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

function formatMoney(cents: number, currency = "BRL") {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format((cents || 0) / 100);
}

function renderUsage(used: number, limit: number) {
    return `${used.toLocaleString("pt-BR")} / ${limit.toLocaleString("pt-BR")}`;
}

export default function BillingPage() {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
    const [usage, setUsage] = useState<BillingUsage | null>(null);
    const [overage, setOverage] = useState<BillingOverageResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        const [orgData, catalogData, usageData, overageData] = await Promise.all([
            organizationApi.getOrganization(),
            billingApi.getCatalog(),
            billingApi.getUsage(),
            billingApi.getOverage(),
        ]);
        setOrganization(orgData);
        setCatalog(catalogData);
        setUsage(usageData);
        setOverage(overageData);
    };

    useEffect(() => {
        setLoading(true);
        refresh()
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Falha ao carregar faturamento.");
            })
            .finally(() => setLoading(false));
    }, []);

    const planCode = (usage?.plan.code || organization?.plan || "STARTER") as PlanCode;

    const periodLabel = useMemo(() => {
        if (!usage) return "";
        const start = new Date(usage.period.startsAt);
        const end = new Date(usage.period.endsAt);
        return `${start.toLocaleDateString("pt-BR")} - ${end.toLocaleDateString("pt-BR")}`;
    }, [usage]);

    const handleChangePlan = async (nextPlan: PlanCode) => {
        setBusy(true);
        setError(null);
        try {
            const updatedUsage = await billingApi.changePlan({ plan: nextPlan });
            setUsage(updatedUsage);
            const orgData = await organizationApi.getOrganization();
            setOrganization(orgData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao trocar plano.");
        } finally {
            setBusy(false);
        }
    };

    const handleBuyOverage = async () => {
        setBusy(true);
        setError(null);
        try {
            await billingApi.purchaseOverage({ packs: 1, notes: "Compra pelo painel" });
            const [usageData, overageData] = await Promise.all([
                billingApi.getUsage(),
                billingApi.getOverage(),
            ]);
            setUsage(usageData);
            setOverage(overageData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao comprar overage.");
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!usage || !catalog) {
        return (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {error || "Nao foi possivel carregar os dados de faturamento."}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Planos e Capacidade</h3>
                <p className="text-sm text-muted-foreground">
                    Todos os recursos estao disponiveis. Seu plano define capacidade de operacao.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Ciclo atual: {periodLabel}</p>
            </div>
            <Separator />

            {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <CardTitle>Plano atual: {usage.plan.label}</CardTitle>
                                <CardDescription>
                                    Preco mensal: {formatMoney(usage.plan.priceCents, usage.plan.currency)}
                                </CardDescription>
                            </div>
                            <Badge variant="default" className="bg-primary">
                                Ativo
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Sinais</span>
                                <span className="font-medium">
                                    {renderUsage(
                                        usage.dimensions.volume.signals.used,
                                        usage.dimensions.volume.signals.limit
                                    )}
                                </span>
                            </div>
                            <Progress
                                value={Math.min(100, usage.dimensions.volume.signals.usagePercent)}
                                className="h-2"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Leads novos</span>
                                <span className="font-medium">
                                    {renderUsage(
                                        usage.dimensions.volume.leads.used,
                                        usage.dimensions.volume.leads.limit
                                    )}
                                </span>
                            </div>
                            <Progress
                                value={Math.min(100, usage.dimensions.volume.leads.usagePercent)}
                                className="h-2"
                            />
                        </div>
                        <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                            Recomendacao automatica:{" "}
                            <span className="font-medium text-foreground">
                                {usage.tierRecommendation.recommendedPlan}
                            </span>
                            . {usage.tierRecommendation.reason}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Overage de sinais</CardTitle>
                        <CardDescription>
                            Pacote {catalog.overage.packUnits.toLocaleString("pt-BR")} sinais por{" "}
                            {formatMoney(catalog.overage.packPriceCents, catalog.overage.currency)}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span>Saldo ativo</span>
                            <span className="font-medium">
                                {(overage?.summary.activeSignalsUnits || 0).toLocaleString("pt-BR")} sinais
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Compras registradas</span>
                            <span className="font-medium">
                                {(overage?.summary.totalPurchases || 0).toLocaleString("pt-BR")}
                            </span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={handleBuyOverage} disabled={busy}>
                            Comprar 1 pacote de overage
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Escala</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div>
                            <div className="mb-1 flex items-center justify-between">
                                <span>Jobs concorrentes</span>
                                <span className="font-medium">
                                    {renderUsage(
                                        usage.dimensions.scale.concurrentJobs.used,
                                        usage.dimensions.scale.concurrentJobs.limit
                                    )}
                                </span>
                            </div>
                            <Progress value={Math.min(100, usage.dimensions.scale.concurrentJobs.usagePercent)} className="h-2" />
                        </div>
                        <div>
                            <div className="mb-1 flex items-center justify-between">
                                <span>Campanhas ativas</span>
                                <span className="font-medium">
                                    {renderUsage(
                                        usage.dimensions.scale.activeCampaigns.used,
                                        usage.dimensions.scale.activeCampaigns.limit
                                    )}
                                </span>
                            </div>
                            <Progress value={Math.min(100, usage.dimensions.scale.activeCampaigns.usagePercent)} className="h-2" />
                        </div>
                        <div>
                            <div className="mb-1 flex items-center justify-between">
                                <span>Assentos</span>
                                <span className="font-medium">
                                    {renderUsage(usage.dimensions.scale.seats.used, usage.dimensions.scale.seats.limit)}
                                </span>
                            </div>
                            <Progress value={Math.min(100, usage.dimensions.scale.seats.usagePercent)} className="h-2" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Automacao e Sofisticacao</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div>
                            <div className="mb-1 flex items-center justify-between">
                                <span>Runs automaticos (dia)</span>
                                <span className="font-medium">
                                    {renderUsage(
                                        usage.dimensions.automation.runsDaily.used,
                                        usage.dimensions.automation.runsDaily.limit
                                    )}
                                </span>
                            </div>
                            <Progress value={Math.min(100, usage.dimensions.automation.runsDaily.usagePercent)} className="h-2" />
                        </div>
                        <div>
                            <div className="mb-1 flex items-center justify-between">
                                <span>Regras de automacao</span>
                                <span className="font-medium">
                                    {renderUsage(
                                        usage.dimensions.automation.rulesTotal.used,
                                        usage.dimensions.automation.rulesTotal.limit
                                    )}
                                </span>
                            </div>
                            <Progress value={Math.min(100, usage.dimensions.automation.rulesTotal.usagePercent)} className="h-2" />
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                            Nivel de sofisticacao:{" "}
                            <span className="font-medium text-foreground">
                                {usage.dimensions.sophistication.level}
                            </span>
                            . Recalculo a cada{" "}
                            <span className="font-medium text-foreground">
                                {usage.dimensions.sophistication.refreshWindowHours}h
                            </span>
                            .
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Catalogo de planos</CardTitle>
                    <CardDescription>Escolha por capacidade de prospeccao.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {catalog.plans.map((plan) => {
                            const isCurrent = plan.code === planCode;
                            return (
                                <Card key={plan.code} className={isCurrent ? "border-primary/40" : ""}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between gap-2">
                                            <CardTitle className="text-base">{plan.label}</CardTitle>
                                            {isCurrent ? <Badge>Atual</Badge> : null}
                                        </div>
                                        <CardDescription>{formatMoney(plan.priceCents, plan.currency)}/mes</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                                        <div>Sinais: {plan.volume.signalsMonthly.toLocaleString("pt-BR")}/mes</div>
                                        <div>Leads: {plan.volume.leadsMonthly.toLocaleString("pt-BR")}/mes</div>
                                        <div>Jobs concorrentes: {plan.scale.concurrentJobs}</div>
                                        <div>Campanhas ativas: {plan.scale.activeCampaigns}</div>
                                        <div>Assentos: {plan.scale.seats}</div>
                                        <div>Runs/dia: {plan.automation.runsDaily}</div>
                                        <div>Regras: {plan.automation.rulesTotal}</div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button
                                            className="w-full"
                                            variant={isCurrent ? "outline" : "default"}
                                            disabled={isCurrent || busy}
                                            onClick={() => handleChangePlan(plan.code)}
                                        >
                                            {isCurrent ? "Plano atual" : "Trocar para este plano"}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Alertas de capacidade</CardTitle>
                </CardHeader>
                <CardContent>
                    {usage.alerts.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Nenhum alerta no momento.</div>
                    ) : (
                        <div className="space-y-2">
                            {usage.alerts.map((alert) => (
                                <div
                                    key={alert.metric}
                                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                                >
                                    <div>
                                        <div className="font-medium">{alert.metric}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {renderUsage(alert.used, alert.limit)}
                                        </div>
                                    </div>
                                    <Badge
                                        variant={
                                            alert.level === "warning"
                                                ? "outline"
                                                : alert.level === "critical"
                                                    ? "secondary"
                                                    : "destructive"
                                        }
                                    >
                                        {alert.level}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}


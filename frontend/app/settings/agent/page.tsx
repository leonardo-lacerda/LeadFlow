"use client";

import { useEffect, useMemo, useState } from "react";
import { IconLoader } from "@tabler/icons-react";
import {
    agentApi,
    AgentConfigResponse,
    AgentConversationInsight,
    AgentGuardrails,
    AgentHandoff,
    AgentMode,
    AgentOptimizationDashboard,
    AgentPolicySummary,
    AgentRun,
    AgentSummary,
} from "@/lib/agent-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const modeLabels: Record<AgentMode, string> = {
    ASSISTED: "Assistido",
    SUPERVISED: "Supervisionado",
    AUTONOMOUS: "Autonomo",
};

const defaultGuardrails: AgentGuardrails = {
    riskLookbackDays: 14,
    riskPauseMinMessages: 25,
    riskPauseBounceRate: 0.08,
    riskPauseErrorRate: 0.15,
};

function normalizeGuardrails(value: AgentGuardrails | null | undefined): AgentGuardrails {
    if (!value) return defaultGuardrails;
    return {
        riskLookbackDays: Math.max(1, Math.min(90, Number(value.riskLookbackDays || 14))),
        riskPauseMinMessages: Math.max(1, Math.min(1000, Number(value.riskPauseMinMessages || 25))),
        riskPauseBounceRate: Math.max(0, Math.min(1, Number(value.riskPauseBounceRate || 0.08))),
        riskPauseErrorRate: Math.max(0, Math.min(1, Number(value.riskPauseErrorRate || 0.15))),
    };
}

function summarizeResult(value: Record<string, unknown> | null | undefined) {
    if (!value) return null;
    try {
        const serialized = JSON.stringify(value);
        if (serialized.length <= 180) {
            return serialized;
        }
        return `${serialized.slice(0, 180)}...`;
    } catch {
        return null;
    }
}

function statusBadgeVariant(status: AgentRun["status"]) {
    if (status === "COMPLETED") return "default";
    if (status === "FAILED") return "destructive";
    if (status === "APPROVAL_REQUIRED") return "secondary";
    return "outline";
}

export default function AgentSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [configData, setConfigData] = useState<AgentConfigResponse | null>(null);
    const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof agentApi.getCatalog>> | null>(
        null
    );
    const [policy, setPolicy] = useState<AgentPolicySummary | null>(null);
    const [summary, setSummary] = useState<AgentSummary | null>(null);
    const [conversations, setConversations] = useState<AgentConversationInsight[]>([]);
    const [optimization, setOptimization] = useState<AgentOptimizationDashboard | null>(null);
    const [runs, setRuns] = useState<AgentRun[]>([]);
    const [handoffs, setHandoffs] = useState<AgentHandoff[]>([]);
    const [selectedMode, setSelectedMode] = useState<AgentMode>("ASSISTED");
    const [northStarTarget, setNorthStarTarget] = useState<number>(10);
    const [guardrails, setGuardrails] = useState<AgentGuardrails>(defaultGuardrails);
    const [runContextText, setRunContextText] = useState<string>("{}");
    const [decisionPayloadDrafts, setDecisionPayloadDrafts] = useState<Record<string, string>>({});

    const refresh = async () => {
        const [config, catalogData, policyData, summaryData, conversationsData, optimizationData, runsResponse, handoffsResponse] = await Promise.all([
            agentApi.getConfig(),
            agentApi.getCatalog(),
            agentApi.getPolicy(),
            agentApi.getSummary({ lookbackDays: 30 }),
            agentApi.getConversations({ limit: 12 }),
            agentApi.getOptimization({ lookbackDays: 30 }),
            agentApi.listRuns({ page: 1, limit: 10 }),
            agentApi.listHandoffs({ page: 1, limit: 20 }),
        ]);
        setConfigData(config);
        setCatalog(catalogData);
        setPolicy(policyData);
        setSummary(summaryData);
        setConversations(conversationsData.items);
        setOptimization(optimizationData);
        setRuns(runsResponse.data);
        setHandoffs(handoffsResponse.data);
        setSelectedMode(config.config.mode);
        setNorthStarTarget(config.config.northStarMonthlyMeetings);
        setGuardrails(normalizeGuardrails(config.config.guardrails));
        setDecisionPayloadDrafts(
            runsResponse.data.reduce<Record<string, string>>((acc, run) => {
                for (const decision of run.decisions) {
                    if (decision.status === "PROPOSED" && decision.actionPayload) {
                        acc[decision.id] = JSON.stringify(decision.actionPayload, null, 2);
                    }
                }
                return acc;
            }, {})
        );
    };

    useEffect(() => {
        setLoading(true);
        refresh()
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Falha ao carregar configuracao do agente.");
            })
            .finally(() => setLoading(false));
    }, []);

    const currentRun = useMemo(() => runs[0] || null, [runs]);
    const allowedModes = configData?.planAgentCapabilities.allowedModes || ["ASSISTED"];

    const parseRunContext = () => {
        const raw = runContextText.trim();
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("O contexto do run deve ser um objeto JSON.");
        }
        return parsed as Record<string, unknown>;
    };

    const handleSaveConfig = async () => {
        setBusy(true);
        setError(null);
        try {
            await agentApi.updateConfig({
                mode: selectedMode,
                northStarMonthlyMeetings: northStarTarget,
                guardrails,
            });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao salvar configuracao.");
        } finally {
            setBusy(false);
        }
    };

    const handleDryRun = async () => {
        setBusy(true);
        setError(null);
        try {
            const context = parseRunContext();
            await agentApi.createDryRun({
                mode: selectedMode,
                trigger: "manual_dry_run",
                context,
            });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao executar dry-run.");
        } finally {
            setBusy(false);
        }
    };

    const handleCreateRun = async () => {
        setBusy(true);
        setError(null);
        try {
            const context = parseRunContext();
            await agentApi.createRun({
                mode: selectedMode,
                trigger: "manual_run",
                context,
            });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao iniciar execucao do agente.");
        } finally {
            setBusy(false);
        }
    };

    const handleExecuteApproved = async (runId: string) => {
        setBusy(true);
        setError(null);
        try {
            await agentApi.executeApproved(runId);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao executar decisoes aprovadas.");
        } finally {
            setBusy(false);
        }
    };

    const handleApprove = async (decision: AgentRun["decisions"][number]) => {
        setBusy(true);
        setError(null);
        try {
            const rawDraft = decisionPayloadDrafts[decision.id]?.trim();
            let actionPayload: Record<string, unknown> | undefined = undefined;
            if (rawDraft) {
                const parsed = JSON.parse(rawDraft);
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                    throw new Error("Payload da decisao deve ser um objeto JSON.");
                }
                actionPayload = parsed as Record<string, unknown>;
            }
            await agentApi.approveDecision(decision.id, { execute: true, actionPayload });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao aprovar decisao.");
        } finally {
            setBusy(false);
        }
    };

    const handleAutoCycle = async () => {
        setBusy(true);
        setError(null);
        try {
            await agentApi.runAutoCycle();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao rodar ciclo automatico.");
        } finally {
            setBusy(false);
        }
    };

    const handleReject = async (decisionId: string) => {
        setBusy(true);
        setError(null);
        try {
            await agentApi.rejectDecision(decisionId);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao rejeitar decisao.");
        } finally {
            setBusy(false);
        }
    };

    const handleResolveHandoff = async (handoffId: string) => {
        setBusy(true);
        setError(null);
        try {
            await agentApi.resolveHandoff(handoffId, {
                notes: "Resolvido manualmente pela equipe.",
            });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao resolver handoff.");
        } finally {
            setBusy(false);
        }
    };

    const handleConversationFeedback = async (
        messageId: string,
        outcome: "POSITIVE" | "NEGATIVE" | "NEUTRAL"
    ) => {
        setBusy(true);
        setError(null);
        try {
            await agentApi.sendConversationFeedback(messageId, { outcome });
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao registrar feedback de conversa.");
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

    if (!configData || !catalog || !policy || !summary || !optimization) {
        return (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {error || "Nao foi possivel carregar o modulo do agente."}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">SDR Autonomo por IA</h3>
                <p className="text-sm text-muted-foreground">
                    North Star Metric: {policy.northStarMetric.label}.
                </p>
            </div>
            <Separator />

            {error ? (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">North Star (mes)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                        <p className="font-medium">
                            {summary.northStar.meetingsThisMonth} / {summary.northStar.targetMonthly}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {summary.northStar.progressPercent}% da meta mensal
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Runs automaticos (hoje)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                        <p className="font-medium">
                            {summary.automationQuota.usedToday} / {summary.automationQuota.limitDaily}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Restante: {summary.automationQuota.remainingToday}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Autoexecucao baixo risco</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                        <p className="font-medium">{summary.decisions.lowRiskAutoExecutionRate}%</p>
                        <p className="text-xs text-muted-foreground">
                            Execucao de decisoes low-risk sem aprovacao manual
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Handoffs abertos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                        <p className="font-medium">{summary.handoffs.open}</p>
                        <p className="text-xs text-muted-foreground">
                            Total resolvidos no periodo: {summary.handoffs.resolved}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuracao do agente</CardTitle>
                        <CardDescription>
                            Plano atual: {configData.plan} | Modo padrao do plano:{" "}
                            {modeLabels[configData.planAgentCapabilities.defaultMode]}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Modo operacional</p>
                            <div className="flex flex-wrap gap-2">
                                {(["ASSISTED", "SUPERVISED", "AUTONOMOUS"] as AgentMode[]).map((mode) => {
                                    const allowed = allowedModes.includes(mode);
                                    return (
                                        <Button
                                            key={mode}
                                            type="button"
                                            variant={selectedMode === mode ? "default" : "outline"}
                                            disabled={!allowed || busy}
                                            onClick={() => setSelectedMode(mode)}
                                        >
                                            {modeLabels[mode]}
                                        </Button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Modos disponiveis no seu plano:{" "}
                                {allowedModes.map((mode) => modeLabels[mode]).join(", ")}.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium">Meta mensal (North Star)</p>
                            <Input
                                type="number"
                                min={1}
                                max={10000}
                                value={northStarTarget}
                                onChange={(event) =>
                                    setNorthStarTarget(
                                        Math.max(1, Math.min(10000, Number(event.target.value || 1)))
                                    )
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Meetings qualificadas com minima intervencao humana por mes.
                            </p>
                        </div>

                        <div className="space-y-3 rounded-md border p-3">
                            <p className="text-sm font-medium">Guardrails de risco</p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Lookback (dias)</p>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={90}
                                        value={guardrails.riskLookbackDays}
                                        onChange={(event) =>
                                            setGuardrails((prev) => ({
                                                ...prev,
                                                riskLookbackDays: Math.max(
                                                    1,
                                                    Math.min(90, Number(event.target.value || 1))
                                                ),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Min. mensagens outbound</p>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={guardrails.riskPauseMinMessages}
                                        onChange={(event) =>
                                            setGuardrails((prev) => ({
                                                ...prev,
                                                riskPauseMinMessages: Math.max(
                                                    1,
                                                    Math.min(1000, Number(event.target.value || 1))
                                                ),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Limite de bounce (%)</p>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        value={Number((guardrails.riskPauseBounceRate * 100).toFixed(1))}
                                        onChange={(event) =>
                                            setGuardrails((prev) => ({
                                                ...prev,
                                                riskPauseBounceRate: Math.max(
                                                    0,
                                                    Math.min(1, Number(event.target.value || 0) / 100)
                                                ),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Limite de erro total (%)</p>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        value={Number((guardrails.riskPauseErrorRate * 100).toFixed(1))}
                                        onChange={(event) =>
                                            setGuardrails((prev) => ({
                                                ...prev,
                                                riskPauseErrorRate: Math.max(
                                                    0,
                                                    Math.min(1, Number(event.target.value || 0) / 100)
                                                ),
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                O agente pausa campanhas ativas quando os limites sao excedidos.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveConfig} disabled={busy}>
                            Salvar configuracao
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Matriz de modos por plano</CardTitle>
                        <CardDescription>Diferenciacao comercial e operacional do agente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {catalog.plans.map((plan) => (
                            <div key={plan.code} className="rounded-md border p-3 text-sm">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="font-medium">{plan.label}</p>
                                    {plan.code === configData.plan ? <Badge>Atual</Badge> : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Modo padrao: {modeLabels[plan.agent.defaultMode]}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Modos: {plan.agent.allowedModes.map((mode) => modeLabels[mode]).join(", ")}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Matriz de risco (MVP)</CardTitle>
                    <CardDescription>
                        Acoes de baixo risco podem rodar automatico; alto risco exige supervisao humana.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-sm">
                        <p className="mb-2 font-medium">Baixo risco (autonomas no MVP)</p>
                        <div className="space-y-2 text-xs text-muted-foreground">
                            {policy.riskMatrix.lowRiskActions.map((action) => (
                                <div key={action.actionKey}>
                                    <p className="font-medium text-foreground">{action.title}</p>
                                    <p>{action.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
                        <p className="mb-2 font-medium">Alto risco (sempre supervisionadas)</p>
                        <div className="space-y-2 text-xs text-muted-foreground">
                            {policy.riskMatrix.highRiskActions.map((action) => (
                                <div key={action.actionKey}>
                                    <p className="font-medium text-foreground">{action.title}</p>
                                    <p>{action.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Modos operacionais</CardTitle>
                    <CardDescription>
                        Definicoes padrao para Assistido, Supervisionado e Autonomo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                    {policy.modes.map((mode) => (
                        <div key={mode.mode} className="rounded-md border p-3 text-sm">
                            <p className="font-medium">{mode.label}</p>
                            <p className="text-xs text-muted-foreground">{mode.summary}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Operacao do agente</CardTitle>
                    <CardDescription>Use dry-run para simular antes da execucao real.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Contexto do run (JSON opcional)</p>
                        <Textarea
                            rows={5}
                            value={runContextText}
                            onChange={(event) => setRunContextText(event.target.value)}
                            placeholder='{"proposedIcp":{"industry":["SaaS"],"jobTitles":["Head de Vendas"]}}'
                            disabled={busy}
                        />
                        <p className="text-xs text-muted-foreground">
                            Exemplo: `proposedIcp` ativa decisao supervisionada de mudanca de ICP.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleDryRun} disabled={busy}>
                            Rodar dry-run
                        </Button>
                        <Button onClick={handleCreateRun} disabled={busy}>
                            Iniciar execucao
                        </Button>
                        <Button variant="secondary" onClick={handleAutoCycle} disabled={busy}>
                            Rodar ciclo automatico agora
                        </Button>
                        {currentRun ? (
                            <Button
                                variant="secondary"
                                onClick={() => handleExecuteApproved(currentRun.id)}
                                disabled={busy}
                            >
                                Executar aprovadas (run atual)
                            </Button>
                        ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Pausas por guardrail no periodo: {summary.risk.pausedCampaignsByGuardrail}.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ultimas execucoes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {runs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma execucao registrada.</p>
                    ) : (
                        runs.map((run) => (
                            <div key={run.id} className="rounded-md border p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="font-medium">
                                            Run {run.id.slice(0, 8)} | {modeLabels[run.mode]}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Trigger: {run.trigger} | Criado em{" "}
                                            {new Date(run.createdAt).toLocaleString("pt-BR")}
                                        </p>
                                    </div>
                                    <Badge variant={statusBadgeVariant(run.status)}>{run.status}</Badge>
                                </div>

                                <div className="space-y-2">
                                    {run.decisions.map((decision) => (
                                        <div
                                            key={decision.id}
                                            className="flex flex-col gap-2 rounded-md border p-3 text-sm"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium">{decision.title}</span>
                                                <Badge variant={decision.risk === "HIGH" ? "destructive" : "outline"}>
                                                    {decision.risk}
                                                </Badge>
                                                <Badge variant="secondary">{decision.status}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {decision.reason || "Sem justificativa detalhada."}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                Acao: {decision.actionKey}
                                            </p>
                                            {decision.status === "EXECUTED" && decision.result ? (
                                                <p className="text-[11px] text-muted-foreground">
                                                    Resultado: {summarizeResult(decision.result)}
                                                </p>
                                            ) : null}
                                            {decision.status === "PROPOSED" ? (
                                                <div className="space-y-2">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] text-muted-foreground">
                                                            Payload da acao (opcional)
                                                        </p>
                                                        <Textarea
                                                            rows={4}
                                                            value={decisionPayloadDrafts[decision.id] || ""}
                                                            onChange={(event) =>
                                                                setDecisionPayloadDrafts((prev) => ({
                                                                    ...prev,
                                                                    [decision.id]: event.target.value,
                                                                }))
                                                            }
                                                            placeholder='{"key":"value"}'
                                                            disabled={busy}
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleApprove(decision)}
                                                            disabled={busy}
                                                        >
                                                            Aprovar e executar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleReject(decision.id)}
                                                            disabled={busy}
                                                        >
                                                            Rejeitar
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>

                                {run.handoffs.length > 0 ? (
                                    <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs">
                                        <p className="mb-1 font-medium">Handoffs abertos</p>
                                        {run.handoffs.map((handoff) => (
                                            <p key={handoff.id} className="text-muted-foreground">
                                                - {handoff.reason} ({handoff.status})
                                            </p>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Acoes mais executadas</CardTitle>
                        <CardDescription>Ultimos {summary.lookbackDays} dias.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {summary.decisions.actionBreakdown.length === 0 ? (
                            <p className="text-muted-foreground">Nenhuma acao executada no periodo.</p>
                        ) : (
                            summary.decisions.actionBreakdown.slice(0, 8).map((item) => (
                                <div
                                    key={item.actionKey}
                                    className="flex items-center justify-between rounded-md border p-2"
                                >
                                    <span className="text-xs">{item.actionKey}</span>
                                    <Badge variant="outline">{item.executed}</Badge>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Falhas recentes</CardTitle>
                        <CardDescription>Decisoes que falharam na execucao.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {summary.recentFailures.length === 0 ? (
                            <p className="text-muted-foreground">Nenhuma falha no periodo.</p>
                        ) : (
                            summary.recentFailures.map((failure) => (
                                <div key={failure.id} className="rounded-md border border-destructive/30 p-2">
                                    <p className="text-xs font-medium">{failure.title}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {failure.actionKey} |{" "}
                                        {new Date(failure.updatedAt).toLocaleString("pt-BR")}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {failure.errorMessage || "Erro nao informado."}
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Conversa e qualificacao avancada</CardTitle>
                        <CardDescription>
                            Intencao + objecao + playbook com memoria de thread e feedback loop.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {conversations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Nenhuma conversa pendente para classificacao no momento.
                            </p>
                        ) : (
                            conversations.map((item) => (
                                <div key={item.messageId} className="rounded-md border p-3 text-sm">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <p className="font-medium">
                                            {item.leadName || "Lead sem nome"} |{" "}
                                            {item.companyName || "Sem empresa"}
                                        </p>
                                        <Badge variant="outline">{item.channel}</Badge>
                                        <Badge variant="secondary">{item.intent}</Badge>
                                        <Badge
                                            variant={
                                                item.shouldEscalate ? "destructive" : "outline"
                                            }
                                        >
                                            score {item.handoffReadinessScore}
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Segmento: {item.segment} | Playbook: {item.playbook} |
                                        Variante: {item.suggestedVariant}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Memoria: {item.memory.summary || "Sem contexto recente"}
                                    </p>
                                    <div className="mt-2 rounded-md border bg-muted/30 p-2 text-xs">
                                        {item.suggestedReply}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={busy}
                                            onClick={() =>
                                                handleConversationFeedback(
                                                    item.messageId,
                                                    "POSITIVE"
                                                )
                                            }
                                        >
                                            Feedback positivo
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={busy}
                                            onClick={() =>
                                                handleConversationFeedback(
                                                    item.messageId,
                                                    "NEUTRAL"
                                                )
                                            }
                                        >
                                            Feedback neutro
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={busy}
                                            onClick={() =>
                                                handleConversationFeedback(
                                                    item.messageId,
                                                    "NEGATIVE"
                                                )
                                            }
                                        >
                                            Feedback negativo
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Dashboard executivo</CardTitle>
                        <CardDescription>Resultado, risco e custo do agente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Resultado</p>
                            <p className="font-medium">
                                Replies qualificados: {optimization.executive.results.qualifiedReplies}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Meetings: {optimization.executive.results.meetingsScheduled}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Reply recente: {optimization.executive.results.recentReplyRate}%
                            </p>
                        </div>
                        <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Risco</p>
                            <p className="font-medium">
                                Falhas: {optimization.executive.risk.failedDecisions}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Handoffs abertos: {optimization.executive.risk.openHandoffs}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Pausas guardrail:{" "}
                                {optimization.executive.risk.pausedCampaignsByGuardrail}
                            </p>
                        </div>
                        <div className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Custo/Capacidade</p>
                            <p className="font-medium">
                                Plano:{" "}
                                {(optimization.executive.cost.planPriceCents / 100).toLocaleString(
                                    "pt-BR",
                                    { style: "currency", currency: "BRL" }
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Automacao: {optimization.executive.cost.automationRunsUsed}/
                                {optimization.executive.cost.automationRunsLimit} (
                                {optimization.executive.cost.automationUsagePercent}%)
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Experimentos A/B por segmento/canal</CardTitle>
                        <CardDescription>
                            Controle de variacao de copy com recomendacao de vencedor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {optimization.abRecommendations.length === 0 ? (
                            <p className="text-muted-foreground">
                                Ainda sem volume minimo para recomendar vencedor A/B.
                            </p>
                        ) : (
                            optimization.abRecommendations.slice(0, 8).map((item) => (
                                <div key={`${item.segment}-${item.channel}`} className="rounded-md border p-2">
                                    <p className="text-xs font-medium">
                                        {item.segment} | {item.channel}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Vencedor: {item.winnerVariant} ({item.winnerReplyRate}%)
                                        vs {item.loserVariant} ({item.loserReplyRate}%)
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Lift: {item.liftPercent}%
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Otimizacao por cohort</CardTitle>
                        <CardDescription>
                            Melhor canal/janela e alertas de degradacao operacional.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="rounded-md border p-2 text-xs">
                            <p className="font-medium">
                                Cohort: {optimization.cohort?.code || "Nao disponivel"}
                            </p>
                            <p className="text-muted-foreground">
                                Recomendacao:{" "}
                                {optimization.recommendation
                                    ? `${optimization.recommendation.channel} em ${optimization.recommendation.window}`
                                    : "Sem recomendacao no momento"}
                            </p>
                            {optimization.recommendation ? (
                                <p className="text-muted-foreground">
                                    {optimization.recommendation.rationale}
                                </p>
                            ) : null}
                        </div>
                        {optimization.alerts.length === 0 ? (
                            <p className="text-muted-foreground">
                                Nenhum alerta de degradacao ou capacidade no periodo.
                            </p>
                        ) : (
                            optimization.alerts.slice(0, 8).map((alert, index) => (
                                <div key={`${alert.metric || alert.key || "alert"}-${index}`} className="rounded-md border p-2">
                                    <p className="text-xs font-medium">
                                        {alert.message || alert.metric || alert.key}
                                    </p>
                                    {typeof alert.usagePercent === "number" ? (
                                        <p className="text-[11px] text-muted-foreground">
                                            Uso: {alert.usagePercent}% ({alert.used}/{alert.limit})
                                        </p>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Fila de handoff humano</CardTitle>
                    <CardDescription>Casos de alto risco que exigem intervencao da equipe.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {handoffs.filter((handoff) => handoff.status === "OPEN").length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum handoff aberto.</p>
                    ) : (
                        handoffs
                            .filter((handoff) => handoff.status === "OPEN")
                            .map((handoff) => (
                                <div
                                    key={handoff.id}
                                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 text-sm"
                                >
                                    <div>
                                        <p className="font-medium">{handoff.reason}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {handoff.decision?.title || "Sem decisao associada"} |{" "}
                                            {handoff.lead?.fullName || "Lead nao vinculado"}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleResolveHandoff(handoff.id)}
                                        disabled={busy}
                                    >
                                        Marcar como resolvido
                                    </Button>
                                </div>
                            ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

import { api } from "@/lib/api";
import { PlanCode } from "@/lib/billing-api";

export type AgentMode = "ASSISTED" | "SUPERVISED" | "AUTONOMOUS";
export type AgentRunStatus =
    | "DRAFT"
    | "APPROVAL_REQUIRED"
    | "EXECUTING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
export type AgentDecisionRisk = "LOW" | "HIGH";
export type AgentDecisionStatus =
    | "PROPOSED"
    | "APPROVED"
    | "REJECTED"
    | "EXECUTED"
    | "FAILED"
    | "SKIPPED";
export type AgentConversationIntent = "CURIOUS" | "FIT" | "NOT_FIT" | "DEMO" | "OBJECTION";
export type AgentFeedbackOutcome = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface AgentPlanCatalogItem {
    code: PlanCode;
    label: string;
    priceCents: number;
    currency: "BRL";
    agent: {
        defaultMode: AgentMode;
        allowedModes: AgentMode[];
        autoExecuteLowRisk: boolean;
        requiresApprovalHighRisk: boolean;
    };
}

export interface AgentCatalog {
    plans: AgentPlanCatalogItem[];
}

export interface AgentGuardrails {
    riskLookbackDays: number;
    riskPauseMinMessages: number;
    riskPauseBounceRate: number;
    riskPauseErrorRate: number;
}

export interface AgentPolicySummary {
    northStarMetric: {
        key: string;
        label: string;
    };
    riskMatrix: {
        lowRiskActions: Array<{
            actionKey: string;
            title: string;
            description: string;
            risk: AgentDecisionRisk;
            autonomousInMvp: boolean;
            requiresHumanApproval: boolean;
        }>;
        highRiskActions: Array<{
            actionKey: string;
            title: string;
            description: string;
            risk: AgentDecisionRisk;
            autonomousInMvp: boolean;
            requiresHumanApproval: boolean;
        }>;
    };
    modes: Array<{
        mode: AgentMode;
        label: string;
        summary: string;
    }>;
}

export interface AgentConfigResponse {
    plan: PlanCode;
    planAgentCapabilities: {
        defaultMode: AgentMode;
        allowedModes: AgentMode[];
        autoExecuteLowRisk: boolean;
        requiresApprovalHighRisk: boolean;
    };
    config: {
        id: string;
        organizationId: string;
        mode: AgentMode;
        northStarMonthlyMeetings: number;
        guardrails?: AgentGuardrails | null;
        createdAt: string;
        updatedAt: string;
    };
}

export interface AgentDecision {
    id: string;
    organizationId: string;
    runId: string;
    type: string;
    title: string;
    reason?: string | null;
    risk: AgentDecisionRisk;
    status: AgentDecisionStatus;
    confidence?: number | null;
    actionKey: string;
    actionPayload?: Record<string, unknown> | null;
    result?: Record<string, unknown> | null;
    errorMessage?: string | null;
    requiresApproval: boolean;
    approvedByUserId?: string | null;
    approvedAt?: string | null;
    executedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AgentHandoff {
    id: string;
    reason: string;
    status: "OPEN" | "RESOLVED";
    notes?: string | null;
    leadId?: string | null;
    createdAt: string;
    decision?: {
        id: string;
        title: string;
        risk: AgentDecisionRisk;
        status: AgentDecisionStatus;
    } | null;
    lead?: {
        id: string;
        fullName?: string | null;
        companyName?: string | null;
        email?: string | null;
    } | null;
}

export interface AgentRun {
    id: string;
    organizationId: string;
    mode: AgentMode;
    trigger: string;
    dryRun: boolean;
    status: AgentRunStatus;
    summary?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    decisions: AgentDecision[];
    handoffs: AgentHandoff[];
}

export interface AgentRunsResponse {
    data: AgentRun[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface AgentHandoffsResponse {
    data: AgentHandoff[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface AgentSummary {
    generatedAt: string;
    lookbackDays: number;
    northStar: {
        key: string;
        label: string;
        targetMonthly: number;
        meetingsThisMonth: number;
        progressPercent: number;
    };
    runs: {
        total: number;
        byStatus: Record<string, number>;
        today: number;
    };
    decisions: {
        total: number;
        byStatus: Record<string, number>;
        byRisk: Record<string, number>;
        lowRiskExecutionRate: number;
        lowRiskAutoExecutionRate: number;
        actionBreakdown: Array<{
            actionKey: string;
            executed: number;
        }>;
    };
    handoffs: {
        total: number;
        byStatus: Record<string, number>;
        open: number;
        resolved: number;
    };
    risk: {
        pausedCampaignsByGuardrail: number;
    };
    automationQuota: {
        usedToday: number;
        limitDaily: number;
        remainingToday: number;
        usagePercentToday: number;
    };
    recentFailures: Array<{
        id: string;
        title: string;
        actionKey: string;
        errorMessage?: string | null;
        updatedAt: string;
    }>;
}

export interface AgentConversationInsight {
    leadId: string;
    leadName?: string | null;
    companyName?: string | null;
    segment: string;
    messageId: string;
    messageCreatedAt: string;
    channel: "EMAIL" | "WHATSAPP";
    intent: AgentConversationIntent;
    objectionType?: string | null;
    objectionConfidence?: number | null;
    handoffReadinessScore: number;
    shouldEscalate: boolean;
    playbook: "FIT" | "NOT_FIT" | "DEMO" | "OBJECTION" | "CURIOUS";
    suggestedReply: string;
    suggestedVariant: "A" | "B";
    memory: {
        summary: string;
        recentMessages: Array<{
            direction: "INBOUND" | "OUTBOUND";
            channel: "EMAIL" | "WHATSAPP";
            preview: string;
            createdAt: string;
        }>;
    };
    feedback: {
        reviewedIntent?: string | null;
        reviewedObjectionType?: string | null;
        outcome?: string | null;
        notes?: string | null;
        notedAt?: string | null;
    } | null;
}

export interface AgentConversationInsightsResponse {
    generatedAt: string;
    limit: number;
    scannedLeads: number;
    returned: number;
    items: AgentConversationInsight[];
}

export interface AgentOptimizationDashboard {
    generatedAt: string;
    lookbackDays: number;
    cohort: {
        code: string;
        currentPlan: PlanCode;
        recommendedTier: string;
        usagePercent: number;
    } | null;
    recommendation: {
        channel: "EMAIL" | "WHATSAPP";
        window: string;
        rationale: string;
    } | null;
    channelWindowPerformance: Array<{
        channel: "EMAIL" | "WHATSAPP";
        window: string;
        outbound: number;
        replied: number;
        replyRate: number;
    }>;
    experiments: Array<{
        segment: string;
        channel: "EMAIL" | "WHATSAPP";
        variant: "A" | "B";
        outbound: number;
        replied: number;
        replyRate: number;
    }>;
    abRecommendations: Array<{
        segment: string;
        channel: "EMAIL" | "WHATSAPP";
        winnerVariant: "A" | "B";
        winnerReplyRate: number;
        loserVariant: "A" | "B";
        loserReplyRate: number;
        liftPercent: number;
    }>;
    alerts: Array<{
        metric?: string;
        key?: string;
        used?: number;
        limit?: number;
        usagePercent?: number;
        level?: "warning" | "critical" | "exceeded";
        severity?: "INFO" | "WARNING" | "CRITICAL";
        message?: string;
    }>;
    executive: {
        results: {
            qualifiedReplies: number;
            meetingsScheduled: number;
            intentMix: Record<AgentConversationIntent, number>;
            recentReplyRate: number;
            previousReplyRate: number;
        };
        risk: {
            failedDecisions: number;
            openHandoffs: number;
            pausedCampaignsByGuardrail: number;
        };
        cost: {
            planPriceCents: number;
            planCurrency: string;
            automationRunsUsed: number;
            automationRunsLimit: number;
            automationUsagePercent: number;
            signalsOverageRemaining: number;
        };
    };
}

export const agentApi = {
    async getPolicy(): Promise<AgentPolicySummary> {
        const response = await api.get("/agent/policy");
        return response.data.data as AgentPolicySummary;
    },

    async getCatalog(): Promise<AgentCatalog> {
        const response = await api.get("/agent/catalog");
        return response.data.data as AgentCatalog;
    },

    async getConfig(): Promise<AgentConfigResponse> {
        const response = await api.get("/agent/config");
        return response.data.data as AgentConfigResponse;
    },

    async getSummary(params?: { lookbackDays?: number }): Promise<AgentSummary> {
        const response = await api.get("/agent/summary", { params });
        return response.data.data as AgentSummary;
    },

    async getConversations(params?: { limit?: number }): Promise<AgentConversationInsightsResponse> {
        const response = await api.get("/agent/conversations", { params });
        return response.data.data as AgentConversationInsightsResponse;
    },

    async sendConversationFeedback(
        messageId: string,
        payload: {
            reviewedIntent?: AgentConversationIntent;
            reviewedObjectionType?: string;
            outcome?: AgentFeedbackOutcome;
            notes?: string;
        }
    ): Promise<{
        messageId: string;
        feedback: AgentConversationInsight["feedback"];
    }> {
        const response = await api.post(`/agent/conversations/${messageId}/feedback`, payload);
        return response.data.data as {
            messageId: string;
            feedback: AgentConversationInsight["feedback"];
        };
    },

    async getOptimization(params?: { lookbackDays?: number }): Promise<AgentOptimizationDashboard> {
        const response = await api.get("/agent/optimization", { params });
        return response.data.data as AgentOptimizationDashboard;
    },

    async updateConfig(payload: {
        mode?: AgentMode;
        northStarMonthlyMeetings?: number;
        guardrails?: AgentGuardrails;
    }): Promise<AgentConfigResponse> {
        const response = await api.put("/agent/config", payload);
        return response.data.data as AgentConfigResponse;
    },

    async createDryRun(payload: {
        mode?: AgentMode;
        trigger?: string;
        context?: Record<string, unknown>;
    }): Promise<AgentRun> {
        const response = await api.post("/agent/runs/dry-run", payload);
        return response.data.data as AgentRun;
    },

    async createRun(payload: {
        mode?: AgentMode;
        trigger?: string;
        context?: Record<string, unknown>;
    }): Promise<AgentRun> {
        const response = await api.post("/agent/runs", payload);
        return response.data.data as AgentRun;
    },

    async runAutoCycle(): Promise<{
        organizationId: string;
        executed: boolean;
        runId?: string;
        status?: AgentRunStatus;
        mode?: AgentMode;
        reason?: string;
    }> {
        const response = await api.post("/agent/runs/auto-cycle");
        return response.data.data as {
            organizationId: string;
            executed: boolean;
            runId?: string;
            status?: AgentRunStatus;
            mode?: AgentMode;
            reason?: string;
        };
    },

    async listRuns(params?: { page?: number; limit?: number }): Promise<AgentRunsResponse> {
        const response = await api.get("/agent/runs", { params });
        return {
            data: response.data.data as AgentRun[],
            meta: response.data.meta as AgentRunsResponse["meta"],
        };
    },

    async getRun(runId: string): Promise<AgentRun> {
        const response = await api.get(`/agent/runs/${runId}`);
        return response.data.data as AgentRun;
    },

    async listHandoffs(params?: {
        page?: number;
        limit?: number;
        status?: "OPEN" | "RESOLVED";
    }): Promise<AgentHandoffsResponse> {
        const response = await api.get("/agent/handoffs", { params });
        return {
            data: response.data.data as AgentHandoff[],
            meta: response.data.meta as AgentHandoffsResponse["meta"],
        };
    },

    async resolveHandoff(handoffId: string, payload?: { notes?: string }) {
        const response = await api.patch(`/agent/handoffs/${handoffId}/resolve`, payload || {});
        return response.data.data as AgentHandoff;
    },

    async approveDecision(
        decisionId: string,
        payload?: { execute?: boolean; actionPayload?: Record<string, unknown> }
    ): Promise<AgentRun> {
        const response = await api.post(`/agent/decisions/${decisionId}/approve`, payload || {});
        return response.data.data as AgentRun;
    },

    async rejectDecision(decisionId: string): Promise<AgentRun> {
        const response = await api.post(`/agent/decisions/${decisionId}/reject`);
        return response.data.data as AgentRun;
    },

    async executeApproved(runId: string): Promise<AgentRun> {
        const response = await api.post(`/agent/runs/${runId}/execute-approved`);
        return response.data.data as AgentRun;
    },
};

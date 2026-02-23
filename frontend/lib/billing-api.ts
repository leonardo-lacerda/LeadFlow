import { api } from "@/lib/api";

export type PlanCode = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE";

export interface BillingPlanCatalogItem {
    code: PlanCode;
    label: string;
    priceCents: number;
    currency: "BRL";
    volume: {
        signalsMonthly: number;
        leadsMonthly: number;
    };
    scale: {
        concurrentJobs: number;
        activeCampaigns: number;
        seats: number;
    };
    automation: {
        runsDaily: number;
        rulesTotal: number;
    };
    sophistication: {
        level: "BASE" | "SEGMENTED" | "ADVANCED" | "CUSTOM";
        refreshWindowHours: number;
    };
}

export interface BillingCatalog {
    version: number;
    plans: BillingPlanCatalogItem[];
    overage: {
        metric: string;
        packUnits: number;
        packPriceCents: number;
        currency: "BRL";
    };
}

export interface BillingUsage {
    plan: {
        code: PlanCode;
        version: number;
        label: string;
        priceCents: number;
        currency: string;
    };
    period: {
        startsAt: string;
        endsAt: string;
    };
    dimensions: {
        volume: {
            signals: {
                used: number;
                limit: number;
                baseLimit: number;
                overageRemaining: number;
                remaining: number;
                usagePercent: number;
            };
            leads: {
                used: number;
                limit: number;
                remaining: number;
                usagePercent: number;
            };
        };
        scale: {
            concurrentJobs: {
                used: number;
                limit: number;
                remaining: number;
                usagePercent: number;
            };
            activeCampaigns: {
                used: number;
                limit: number;
                remaining: number;
                usagePercent: number;
            };
            seats: {
                used: number;
                limit: number;
                remaining: number;
                usagePercent: number;
            };
        };
        automation: {
            runsDaily: {
                used: number;
                limit: number;
                remaining: number;
                usagePercent: number;
            };
            rulesTotal: {
                used: number;
                limit: number;
                remaining: number;
                usagePercent: number;
            };
        };
        sophistication: {
            level: "BASE" | "SEGMENTED" | "ADVANCED" | "CUSTOM";
            refreshWindowHours: number;
        };
    };
    alerts: Array<{
        metric: string;
        used: number;
        limit: number;
        usagePercent: number;
        level: "warning" | "critical" | "exceeded";
    }>;
    tierRecommendation: {
        recommendedPlan: PlanCode;
        reason: string;
    };
}

export interface BillingOverageItem {
    id: string;
    metric: string;
    unitsPurchased: number;
    unitsRemaining: number;
    priceCents: number;
    currency: string;
    effectiveFrom: string;
    expiresAt: string;
    notes?: string;
    createdAt: string;
}

export interface BillingOverageResponse {
    summary: {
        activeSignalsUnits: number;
        totalPurchases: number;
    };
    items: BillingOverageItem[];
}

export const billingApi = {
    async getCatalog(): Promise<BillingCatalog> {
        const response = await api.get("/billing/catalog");
        return response.data.data;
    },

    async getUsage(): Promise<BillingUsage> {
        const response = await api.get("/billing/usage");
        return response.data.data;
    },

    async getOverage(): Promise<BillingOverageResponse> {
        const response = await api.get("/billing/overage");
        return response.data.data;
    },

    async purchaseOverage(payload: { packs?: number; notes?: string }) {
        const response = await api.post("/billing/overage/purchase", payload);
        return response.data.data as BillingOverageItem;
    },

    async changePlan(payload: { plan: PlanCode; reason?: string }) {
        const response = await api.post("/billing/change-plan", payload);
        return response.data.data as BillingUsage;
    },
};


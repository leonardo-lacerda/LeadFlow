import { Plan } from '@prisma/client';

export type SophisticationLevel = 'BASE' | 'SEGMENTED' | 'ADVANCED' | 'CUSTOM';
export type AgentMode = 'ASSISTED' | 'SUPERVISED' | 'AUTONOMOUS';

export interface PlanCapabilities {
    code: Plan;
    label: string;
    priceCents: number;
    currency: 'BRL';
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
        level: SophisticationLevel;
        refreshWindowHours: number;
    };
    agent: {
        defaultMode: AgentMode;
        allowedModes: AgentMode[];
        autoExecuteLowRisk: boolean;
        requiresApprovalHighRisk: boolean;
    };
}

export const PLAN_CATALOG_VERSION = 1;
export const SIGNALS_OVERAGE_PACK_UNITS = 5_000;
export const SIGNALS_OVERAGE_PACK_PRICE_CENTS = 14_900;

export const PLAN_CATALOG: Record<Plan, PlanCapabilities> = {
    STARTER: {
        code: 'STARTER',
        label: 'Starter',
        priceCents: 14_900,
        currency: 'BRL',
        volume: {
            signalsMonthly: 2_000,
            leadsMonthly: 500,
        },
        scale: {
            concurrentJobs: 1,
            activeCampaigns: 2,
            seats: 3,
        },
        automation: {
            runsDaily: 10,
            rulesTotal: 10,
        },
        sophistication: {
            level: 'BASE',
            refreshWindowHours: 24,
        },
        agent: {
            defaultMode: 'ASSISTED',
            allowedModes: ['ASSISTED'],
            autoExecuteLowRisk: false,
            requiresApprovalHighRisk: true,
        },
    },
    GROWTH: {
        code: 'GROWTH',
        label: 'Growth',
        priceCents: 39_900,
        currency: 'BRL',
        volume: {
            signalsMonthly: 10_000,
            leadsMonthly: 2_500,
        },
        scale: {
            concurrentJobs: 3,
            activeCampaigns: 8,
            seats: 10,
        },
        automation: {
            runsDaily: 80,
            rulesTotal: 40,
        },
        sophistication: {
            level: 'SEGMENTED',
            refreshWindowHours: 4,
        },
        agent: {
            defaultMode: 'SUPERVISED',
            allowedModes: ['ASSISTED', 'SUPERVISED'],
            autoExecuteLowRisk: true,
            requiresApprovalHighRisk: true,
        },
    },
    SCALE: {
        code: 'SCALE',
        label: 'Scale',
        priceCents: 120_000,
        currency: 'BRL',
        volume: {
            signalsMonthly: 40_000,
            leadsMonthly: 10_000,
        },
        scale: {
            concurrentJobs: 8,
            activeCampaigns: 25,
            seats: 30,
        },
        automation: {
            runsDaily: 400,
            rulesTotal: 150,
        },
        sophistication: {
            level: 'ADVANCED',
            refreshWindowHours: 1,
        },
        agent: {
            defaultMode: 'AUTONOMOUS',
            allowedModes: ['ASSISTED', 'SUPERVISED', 'AUTONOMOUS'],
            autoExecuteLowRisk: true,
            requiresApprovalHighRisk: true,
        },
    },
    ENTERPRISE: {
        code: 'ENTERPRISE',
        label: 'Enterprise',
        priceCents: 300_000,
        currency: 'BRL',
        volume: {
            signalsMonthly: 120_000,
            leadsMonthly: 40_000,
        },
        scale: {
            concurrentJobs: 20,
            activeCampaigns: 60,
            seats: 100,
        },
        automation: {
            runsDaily: 2_000,
            rulesTotal: 600,
        },
        sophistication: {
            level: 'CUSTOM',
            refreshWindowHours: 1,
        },
        agent: {
            defaultMode: 'AUTONOMOUS',
            allowedModes: ['ASSISTED', 'SUPERVISED', 'AUTONOMOUS'],
            autoExecuteLowRisk: true,
            requiresApprovalHighRisk: true,
        },
    },
};

export const PLAN_ORDER: Plan[] = ['STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE'];

export function getPlanCapabilities(plan: Plan): PlanCapabilities {
    return PLAN_CATALOG[plan];
}

export function recommendPlanBySignalsUsage(signalsUsed: number): Plan {
    for (const plan of PLAN_ORDER) {
        if (signalsUsed <= PLAN_CATALOG[plan].volume.signalsMonthly) {
            return plan;
        }
    }
    return 'ENTERPRISE';
}

export function toLegacyLimits(plan: Plan) {
    const caps = PLAN_CATALOG[plan];
    return {
        leadsLimit: caps.volume.leadsMonthly,
        emailsLimit: caps.volume.signalsMonthly,
        whatsappLimit: caps.volume.signalsMonthly,
        enrichmentsLimit: caps.volume.signalsMonthly,
    };
}

export function getAgentCapabilities(plan: Plan) {
    return PLAN_CATALOG[plan].agent;
}

export function isAgentModeAllowed(plan: Plan, mode: AgentMode) {
    return PLAN_CATALOG[plan].agent.allowedModes.includes(mode);
}

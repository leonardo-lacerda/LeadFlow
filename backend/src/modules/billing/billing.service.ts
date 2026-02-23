import {
    CampaignStatus,
    JobStatus,
    Plan,
    PlanChangeSource,
    Prisma,
    UsagePeriodType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { LimitExceededError } from './billing.errors.js';
import {
    getPlanCapabilities,
    PLAN_CATALOG,
    PLAN_CATALOG_VERSION,
    recommendPlanBySignalsUsage,
    SIGNALS_OVERAGE_PACK_PRICE_CENTS,
    SIGNALS_OVERAGE_PACK_UNITS,
    toLegacyLimits,
} from './plan-catalog.js';

const PLAN_ORDER: Plan[] = ['STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE'];
const JOB_STATUSES_IN_FLIGHT: JobStatus[] = ['PENDING', 'RUNNING'];

type PrismaTx = Prisma.TransactionClient;

type CounterMetric = 'signals_monthly' | 'leads_monthly' | 'automation_runs_daily';
type DynamicMetric = 'concurrent_jobs' | 'active_campaigns' | 'seats_total' | 'automation_rules_total';

type BillingDimension = 'volume' | 'scale' | 'automation' | 'sophistication';

interface ConsumeMetricInput {
    organizationId: string;
    metric: CounterMetric;
    units: number;
    operationKey?: string;
    metadata?: Prisma.InputJsonValue;
    now?: Date;
}

interface DynamicLimitInput {
    organizationId: string;
    metric: DynamicMetric;
    requested: number;
    now?: Date;
}

function getMonthStartUtc(base: Date) {
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
}

function getNextMonthStartUtc(base: Date) {
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
}

function getDayStartUtc(base: Date) {
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
}

function usagePercent(used: number, limit: number) {
    if (limit <= 0) {
        return 0;
    }
    return Math.round((used / limit) * 10000) / 100;
}

function metricPeriod(metric: CounterMetric, now: Date) {
    if (metric === 'automation_runs_daily') {
        return {
            periodType: UsagePeriodType.DAILY,
            periodStart: getDayStartUtc(now),
        };
    }

    return {
        periodType: UsagePeriodType.MONTHLY,
        periodStart: getMonthStartUtc(now),
    };
}

function metricConfig(metric: CounterMetric, plan: Plan) {
    const caps = getPlanCapabilities(plan);
    switch (metric) {
        case 'signals_monthly':
            return {
                dimension: 'volume' as const,
                limit: caps.volume.signalsMonthly,
            };
        case 'leads_monthly':
            return {
                dimension: 'volume' as const,
                limit: caps.volume.leadsMonthly,
            };
        case 'automation_runs_daily':
            return {
                dimension: 'automation' as const,
                limit: caps.automation.runsDaily,
            };
        default:
            return {
                dimension: 'volume' as const,
                limit: 0,
            };
    }
}

function nextPlan(currentPlan: Plan): Plan {
    const index = PLAN_ORDER.indexOf(currentPlan);
    if (index < 0 || index >= PLAN_ORDER.length - 1) {
        return 'ENTERPRISE';
    }
    return PLAN_ORDER[index + 1];
}

function toBillingCycle(now: Date) {
    const startsAt = getMonthStartUtc(now);
    const endsAt = getNextMonthStartUtc(now);
    return { startsAt, endsAt };
}

export class BillingService {
    private async ensurePlanConfigTx(
        tx: PrismaTx,
        organizationId: string,
        currentPlan: Plan,
        now: Date
    ) {
        const caps = getPlanCapabilities(currentPlan);
        const cycle = toBillingCycle(now);

        await tx.organizationPlanConfig.upsert({
            where: { organizationId },
            update: {
                currentPlan,
                planVersion: PLAN_CATALOG_VERSION,
                monthlyPriceCents: caps.priceCents,
                currency: caps.currency,
            },
            create: {
                organizationId,
                currentPlan,
                planVersion: PLAN_CATALOG_VERSION,
                monthlyPriceCents: caps.priceCents,
                currency: caps.currency,
                cycleStartedAt: cycle.startsAt,
                cycleEndsAt: cycle.endsAt,
                autoRenew: true,
            },
        });
    }

    async ensurePlanConfig(organizationId: string) {
        const now = new Date();
        await prisma.$transaction(async (tx) => {
            const org = await tx.organization.findUnique({
                where: { id: organizationId },
                select: { id: true, plan: true },
            });
            if (!org) {
                throw new Error('Organization not found');
            }
            await this.ensurePlanConfigTx(tx, organizationId, org.plan, now);
        });
    }

    private async getOrganizationPlanTx(tx: PrismaTx, organizationId: string) {
        const org = await tx.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                plan: true,
            },
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        return org.plan;
    }

    private async getCounterUsedTx(
        tx: PrismaTx,
        organizationId: string,
        metric: CounterMetric,
        periodType: UsagePeriodType,
        periodStart: Date
    ) {
        const counter = await tx.organizationUsageCounter.findUnique({
            where: {
                organizationId_metric_periodType_periodStart: {
                    organizationId,
                    metric,
                    periodType,
                    periodStart,
                },
            },
            select: {
                used: true,
            },
        });
        return counter?.used ?? 0;
    }

    private async ensureCounterTx(
        tx: PrismaTx,
        organizationId: string,
        metric: CounterMetric,
        periodType: UsagePeriodType,
        periodStart: Date
    ) {
        return tx.organizationUsageCounter.upsert({
            where: {
                organizationId_metric_periodType_periodStart: {
                    organizationId,
                    metric,
                    periodType,
                    periodStart,
                },
            },
            update: {},
            create: {
                organizationId,
                metric,
                periodType,
                periodStart,
                used: 0,
            },
            select: {
                id: true,
                used: true,
            },
        });
    }

    private async activeSignalsOverageTx(tx: PrismaTx, organizationId: string, now: Date) {
        const aggregate = await tx.planOveragePurchase.aggregate({
            where: {
                organizationId,
                metric: 'signals_monthly',
                effectiveFrom: { lte: now },
                expiresAt: { gt: now },
                unitsRemaining: { gt: 0 },
            },
            _sum: {
                unitsRemaining: true,
            },
        });
        return aggregate._sum.unitsRemaining ?? 0;
    }

    private async consumeOverageSignalsTx(
        tx: PrismaTx,
        organizationId: string,
        units: number,
        now: Date
    ) {
        if (units <= 0) {
            return;
        }

        const purchases = await tx.planOveragePurchase.findMany({
            where: {
                organizationId,
                metric: 'signals_monthly',
                effectiveFrom: { lte: now },
                expiresAt: { gt: now },
                unitsRemaining: { gt: 0 },
            },
            orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                unitsRemaining: true,
            },
        });

        let remainingToConsume = units;
        for (const purchase of purchases) {
            if (remainingToConsume <= 0) {
                break;
            }
            const decrement = Math.min(remainingToConsume, purchase.unitsRemaining);
            await tx.planOveragePurchase.update({
                where: { id: purchase.id },
                data: {
                    unitsRemaining: {
                        decrement,
                    },
                },
            });
            remainingToConsume -= decrement;
        }

        if (remainingToConsume > 0) {
            throw new Error('Unable to consume overage units');
        }
    }

    private async writeLedgerTx(
        tx: PrismaTx,
        input: {
            organizationId: string;
            dimension: BillingDimension;
            metric: string;
            operation: string;
            units: number;
            operationKey?: string;
            periodType?: UsagePeriodType;
            periodStart?: Date;
            metadata?: Prisma.InputJsonValue;
        }
    ) {
        if (input.operationKey) {
            const existing = await tx.usageLedger.findUnique({
                where: { operationKey: input.operationKey },
                select: { id: true },
            });
            if (existing) {
                return { idempotent: true };
            }
        }

        await tx.usageLedger.create({
            data: {
                organizationId: input.organizationId,
                dimension: input.dimension,
                metric: input.metric,
                operation: input.operation,
                units: input.units,
                operationKey: input.operationKey,
                periodType: input.periodType,
                periodStart: input.periodStart,
                metadata: input.metadata,
            },
        });

        return { idempotent: false };
    }

    private async consumeCounterMetricTx(tx: PrismaTx, input: ConsumeMetricInput) {
        const now = input.now || new Date();
        const plan = await this.getOrganizationPlanTx(tx, input.organizationId);
        const metricInfo = metricConfig(input.metric, plan);
        const { periodType, periodStart } = metricPeriod(input.metric, now);
        if (input.operationKey) {
            const existing = await tx.usageLedger.findUnique({
                where: { operationKey: input.operationKey },
                select: { id: true },
            });
            if (existing) {
                const used = await this.getCounterUsedTx(
                    tx,
                    input.organizationId,
                    input.metric,
                    periodType,
                    periodStart
                );
                let limit = metricInfo.limit;
                if (input.metric === 'signals_monthly') {
                    limit += await this.activeSignalsOverageTx(tx, input.organizationId, now);
                }
                return {
                    used,
                    limit,
                    remaining: Math.max(0, limit - used),
                    periodType,
                    periodStart,
                };
            }
        }

        const counter = await this.ensureCounterTx(
            tx,
            input.organizationId,
            input.metric,
            periodType,
            periodStart
        );

        let effectiveLimit = metricInfo.limit;
        if (input.metric === 'signals_monthly') {
            effectiveLimit += await this.activeSignalsOverageTx(tx, input.organizationId, now);
        }

        const canUpdate = await tx.organizationUsageCounter.updateMany({
            where: {
                id: counter.id,
                used: {
                    lte: effectiveLimit - input.units,
                },
            },
            data: {
                used: {
                    increment: input.units,
                },
            },
        });

        if (canUpdate.count === 0) {
            const used = await this.getCounterUsedTx(
                tx,
                input.organizationId,
                input.metric,
                periodType,
                periodStart
            );
            throw new LimitExceededError({
                dimension: metricInfo.dimension,
                metric: input.metric,
                currentPlan: plan,
                used,
                requested: input.units,
                limit: effectiveLimit,
                remaining: Math.max(0, effectiveLimit - used),
                recommendedPlan: nextPlan(plan),
            });
        }

        const updatedCounter = await tx.organizationUsageCounter.findUnique({
            where: { id: counter.id },
            select: { used: true },
        });
        const usedAfter = updatedCounter?.used ?? counter.used + input.units;
        const usedBefore = usedAfter - input.units;

        if (input.metric === 'signals_monthly') {
            const baseLimit = metricInfo.limit;
            const overageUsedBefore = Math.max(0, usedBefore - baseLimit);
            const overageUsedAfter = Math.max(0, usedAfter - baseLimit);
            const overageDelta = overageUsedAfter - overageUsedBefore;
            if (overageDelta > 0) {
                await this.consumeOverageSignalsTx(tx, input.organizationId, overageDelta, now);
            }
        }

        await this.writeLedgerTx(tx, {
            organizationId: input.organizationId,
            dimension: metricInfo.dimension,
            metric: input.metric,
            operation: 'consume',
            units: input.units,
            operationKey: input.operationKey,
            periodType,
            periodStart,
            metadata: input.metadata,
        });

        return {
            used: usedAfter,
            limit: effectiveLimit,
            remaining: Math.max(0, effectiveLimit - usedAfter),
            periodType,
            periodStart,
        };
    }

    async consumeMetric(input: ConsumeMetricInput) {
        return prisma.$transaction((tx) => this.consumeCounterMetricTx(tx, input));
    }

    async consumeLeads(organizationId: string, units: number, operationKey?: string) {
        return this.consumeMetric({
            organizationId,
            metric: 'leads_monthly',
            units,
            operationKey,
        });
    }

    async consumeSignals(
        organizationId: string,
        units: number,
        operationKey?: string,
        metadata?: Prisma.InputJsonValue
    ) {
        return this.consumeMetric({
            organizationId,
            metric: 'signals_monthly',
            units,
            operationKey,
            metadata,
        });
    }

    async consumeAutomationRuns(organizationId: string, units: number, operationKey?: string) {
        return this.consumeMetric({
            organizationId,
            metric: 'automation_runs_daily',
            units,
            operationKey,
        });
    }

    async consumeLeadsTx(
        tx: PrismaTx,
        organizationId: string,
        units: number,
        operationKey?: string
    ) {
        return this.consumeCounterMetricTx(tx, {
            organizationId,
            metric: 'leads_monthly',
            units,
            operationKey,
        });
    }

    async getRemainingLeadsTx(tx: PrismaTx, organizationId: string, at?: Date) {
        const now = at || new Date();
        const plan = await this.getOrganizationPlanTx(tx, organizationId);
        const caps = getPlanCapabilities(plan);
        const { periodType, periodStart } = metricPeriod('leads_monthly', now);
        const used = await this.getCounterUsedTx(tx, organizationId, 'leads_monthly', periodType, periodStart);
        return Math.max(0, caps.volume.leadsMonthly - used);
    }

    private async assertDynamicLimitTx(tx: PrismaTx, input: DynamicLimitInput) {
        const now = input.now || new Date();
        const plan = await this.getOrganizationPlanTx(tx, input.organizationId);
        const caps = getPlanCapabilities(plan);

        let used = 0;
        let limit = 0;
        let dimension: BillingDimension = 'scale';

        if (input.metric === 'concurrent_jobs') {
            dimension = 'scale';
            limit = caps.scale.concurrentJobs;
            used = await this.countConcurrentJobsTx(tx, input.organizationId);
        } else if (input.metric === 'active_campaigns') {
            dimension = 'scale';
            limit = caps.scale.activeCampaigns;
            used = await this.countActiveCampaignsTx(tx, input.organizationId);
        } else if (input.metric === 'seats_total') {
            dimension = 'scale';
            limit = caps.scale.seats;
            used = await this.countSeatsTx(tx, input.organizationId);
        } else if (input.metric === 'automation_rules_total') {
            dimension = 'automation';
            limit = caps.automation.rulesTotal;
            used = await this.countAutomationRulesTx(tx, input.organizationId);
        }

        if (used + input.requested > limit) {
            throw new LimitExceededError({
                dimension,
                metric: input.metric,
                currentPlan: plan,
                used,
                requested: input.requested,
                limit,
                remaining: Math.max(0, limit - used),
                recommendedPlan: nextPlan(plan),
            });
        }

        await this.writeLedgerTx(tx, {
            organizationId: input.organizationId,
            dimension,
            metric: input.metric,
            operation: 'check',
            units: input.requested,
            metadata: {
                checkedAt: now.toISOString(),
                used,
                limit,
            },
        });
    }

    async assertConcurrentJobsLimit(organizationId: string, requested = 1) {
        await prisma.$transaction((tx) =>
            this.assertDynamicLimitTx(tx, { organizationId, metric: 'concurrent_jobs', requested })
        );
    }

    async assertActiveCampaignsLimit(organizationId: string, requested = 1) {
        await prisma.$transaction((tx) =>
            this.assertDynamicLimitTx(tx, { organizationId, metric: 'active_campaigns', requested })
        );
    }

    async assertSeatsLimit(organizationId: string, requested = 1) {
        await prisma.$transaction((tx) =>
            this.assertDynamicLimitTx(tx, { organizationId, metric: 'seats_total', requested })
        );
    }

    async assertSeatsLimitTx(tx: PrismaTx, organizationId: string, requested = 1) {
        return this.assertDynamicLimitTx(tx, { organizationId, metric: 'seats_total', requested });
    }

    async assertAutomationRulesLimit(organizationId: string, requested = 1) {
        await prisma.$transaction((tx) =>
            this.assertDynamicLimitTx(tx, { organizationId, metric: 'automation_rules_total', requested })
        );
    }

    async assertSignalCapacity(organizationId: string, requestedUnits: number) {
        await prisma.$transaction(async (tx) => {
            const now = new Date();
            const plan = await this.getOrganizationPlanTx(tx, organizationId);
            const caps = getPlanCapabilities(plan);
            const { periodType, periodStart } = metricPeriod('signals_monthly', now);
            const used = await this.getCounterUsedTx(
                tx,
                organizationId,
                'signals_monthly',
                periodType,
                periodStart
            );
            const overage = await this.activeSignalsOverageTx(tx, organizationId, now);
            const limit = caps.volume.signalsMonthly + overage;

            if (used + requestedUnits > limit) {
                throw new LimitExceededError({
                    dimension: 'volume',
                    metric: 'signals_monthly',
                    currentPlan: plan,
                    used,
                    requested: requestedUnits,
                    limit,
                    remaining: Math.max(0, limit - used),
                    recommendedPlan: nextPlan(plan),
                });
            }
        });
    }

    private async countConcurrentJobsTx(tx: PrismaTx, organizationId: string) {
        const [scraping, enrichment, ai] = await Promise.all([
            tx.scrapingJob.count({
                where: {
                    organizationId,
                    status: { in: JOB_STATUSES_IN_FLIGHT },
                },
            }),
            tx.enrichmentJob.count({
                where: {
                    organizationId,
                    status: { in: JOB_STATUSES_IN_FLIGHT },
                },
            }),
            tx.aiJob.count({
                where: {
                    organizationId,
                    status: { in: JOB_STATUSES_IN_FLIGHT },
                },
            }),
        ]);

        return scraping + enrichment + ai;
    }

    private async countActiveCampaignsTx(tx: PrismaTx, organizationId: string) {
        return tx.campaign.count({
            where: {
                organizationId,
                status: CampaignStatus.ACTIVE,
            },
        });
    }

    private async countSeatsTx(tx: PrismaTx, organizationId: string) {
        return tx.user.count({
            where: {
                organizationId,
            },
        });
    }

    private async countAutomationRulesTx(tx: PrismaTx, organizationId: string) {
        const [scheduledScraping, activeCampaigns] = await Promise.all([
            tx.scrapingJob.count({
                where: {
                    organizationId,
                    schedule: { not: null },
                    status: { not: JobStatus.CANCELLED },
                },
            }),
            tx.campaign.count({
                where: {
                    organizationId,
                    status: CampaignStatus.ACTIVE,
                },
            }),
        ]);

        return scheduledScraping + activeCampaigns;
    }

    async getUsageSnapshot(organizationId: string) {
        const now = new Date();
        return prisma.$transaction(async (tx) => {
            const org = await tx.organization.findUnique({
                where: { id: organizationId },
                select: {
                    id: true,
                    plan: true,
                    planVersion: true,
                },
            });
            if (!org) {
                throw new Error('Organization not found');
            }

            await this.ensurePlanConfigTx(tx, organizationId, org.plan, now);

            const caps = getPlanCapabilities(org.plan);
            const cycle = toBillingCycle(now);
            const [
                leadsUsed,
                signalsUsed,
                automationRunsDaily,
                overageRemaining,
                concurrentJobs,
                activeCampaigns,
                seatsTotal,
                automationRulesTotal,
            ] = await Promise.all([
                this.getCounterUsedTx(
                    tx,
                    organizationId,
                    'leads_monthly',
                    UsagePeriodType.MONTHLY,
                    cycle.startsAt
                ),
                this.getCounterUsedTx(
                    tx,
                    organizationId,
                    'signals_monthly',
                    UsagePeriodType.MONTHLY,
                    cycle.startsAt
                ),
                this.getCounterUsedTx(
                    tx,
                    organizationId,
                    'automation_runs_daily',
                    UsagePeriodType.DAILY,
                    getDayStartUtc(now)
                ),
                this.activeSignalsOverageTx(tx, organizationId, now),
                this.countConcurrentJobsTx(tx, organizationId),
                this.countActiveCampaignsTx(tx, organizationId),
                this.countSeatsTx(tx, organizationId),
                this.countAutomationRulesTx(tx, organizationId),
            ]);

            const signalsLimit = caps.volume.signalsMonthly + overageRemaining;
            const recommendedPlan = recommendPlanBySignalsUsage(signalsUsed);

            const alerts = [
                {
                    metric: 'signals_monthly',
                    used: signalsUsed,
                    limit: signalsLimit,
                    usagePercent: usagePercent(signalsUsed, signalsLimit),
                },
                {
                    metric: 'leads_monthly',
                    used: leadsUsed,
                    limit: caps.volume.leadsMonthly,
                    usagePercent: usagePercent(leadsUsed, caps.volume.leadsMonthly),
                },
                {
                    metric: 'automation_runs_daily',
                    used: automationRunsDaily,
                    limit: caps.automation.runsDaily,
                    usagePercent: usagePercent(automationRunsDaily, caps.automation.runsDaily),
                },
            ]
                .map((item) => {
                    const level =
                        item.usagePercent >= 100
                            ? 'exceeded'
                            : item.usagePercent >= 85
                                ? 'critical'
                                : item.usagePercent >= 70
                                    ? 'warning'
                                    : null;
                    return level ? { ...item, level } : null;
                })
                .filter((item): item is NonNullable<typeof item> => Boolean(item));

            return {
                plan: {
                    code: org.plan,
                    version: org.planVersion,
                    label: caps.label,
                    priceCents: caps.priceCents,
                    currency: caps.currency,
                },
                period: {
                    startsAt: cycle.startsAt.toISOString(),
                    endsAt: cycle.endsAt.toISOString(),
                },
                dimensions: {
                    volume: {
                        signals: {
                            used: signalsUsed,
                            limit: signalsLimit,
                            baseLimit: caps.volume.signalsMonthly,
                            overageRemaining,
                            remaining: Math.max(0, signalsLimit - signalsUsed),
                            usagePercent: usagePercent(signalsUsed, signalsLimit),
                        },
                        leads: {
                            used: leadsUsed,
                            limit: caps.volume.leadsMonthly,
                            remaining: Math.max(0, caps.volume.leadsMonthly - leadsUsed),
                            usagePercent: usagePercent(leadsUsed, caps.volume.leadsMonthly),
                        },
                    },
                    scale: {
                        concurrentJobs: {
                            used: concurrentJobs,
                            limit: caps.scale.concurrentJobs,
                            remaining: Math.max(0, caps.scale.concurrentJobs - concurrentJobs),
                            usagePercent: usagePercent(concurrentJobs, caps.scale.concurrentJobs),
                        },
                        activeCampaigns: {
                            used: activeCampaigns,
                            limit: caps.scale.activeCampaigns,
                            remaining: Math.max(0, caps.scale.activeCampaigns - activeCampaigns),
                            usagePercent: usagePercent(activeCampaigns, caps.scale.activeCampaigns),
                        },
                        seats: {
                            used: seatsTotal,
                            limit: caps.scale.seats,
                            remaining: Math.max(0, caps.scale.seats - seatsTotal),
                            usagePercent: usagePercent(seatsTotal, caps.scale.seats),
                        },
                    },
                    automation: {
                        runsDaily: {
                            used: automationRunsDaily,
                            limit: caps.automation.runsDaily,
                            remaining: Math.max(0, caps.automation.runsDaily - automationRunsDaily),
                            usagePercent: usagePercent(automationRunsDaily, caps.automation.runsDaily),
                        },
                        rulesTotal: {
                            used: automationRulesTotal,
                            limit: caps.automation.rulesTotal,
                            remaining: Math.max(0, caps.automation.rulesTotal - automationRulesTotal),
                            usagePercent: usagePercent(automationRulesTotal, caps.automation.rulesTotal),
                        },
                    },
                    sophistication: {
                        level: caps.sophistication.level,
                        refreshWindowHours: caps.sophistication.refreshWindowHours,
                    },
                },
                alerts,
                tierRecommendation: {
                    recommendedPlan,
                    reason:
                        recommendedPlan === org.plan
                            ? 'Consumo atual compativel com o plano.'
                            : 'Consumo atual indica necessidade de upgrade de capacidade.',
                },
            };
        });
    }

    async getCatalog() {
        return {
            version: PLAN_CATALOG_VERSION,
            plans: PLAN_ORDER.map((plan) => PLAN_CATALOG[plan]),
            overage: {
                metric: 'signals_monthly',
                packUnits: SIGNALS_OVERAGE_PACK_UNITS,
                packPriceCents: SIGNALS_OVERAGE_PACK_PRICE_CENTS,
                currency: 'BRL',
            },
        };
    }

    async listOveragePurchases(organizationId: string) {
        const now = new Date();
        const [items, remainingAggregate] = await Promise.all([
            prisma.planOveragePurchase.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    metric: true,
                    unitsPurchased: true,
                    unitsRemaining: true,
                    priceCents: true,
                    currency: true,
                    effectiveFrom: true,
                    expiresAt: true,
                    notes: true,
                    createdAt: true,
                },
            }),
            prisma.planOveragePurchase.aggregate({
                where: {
                    organizationId,
                    metric: 'signals_monthly',
                    effectiveFrom: { lte: now },
                    expiresAt: { gt: now },
                    unitsRemaining: { gt: 0 },
                },
                _sum: {
                    unitsRemaining: true,
                },
            }),
        ]);

        return {
            summary: {
                activeSignalsUnits: remainingAggregate._sum.unitsRemaining ?? 0,
                totalPurchases: items.length,
            },
            items,
        };
    }

    async purchaseSignalsOverage(
        organizationId: string,
        createdByUserId: string,
        packs: number,
        notes?: string
    ) {
        const safePacks = Number.isFinite(packs) ? Math.max(1, Math.floor(packs)) : 1;
        const now = new Date();
        const cycle = toBillingCycle(now);
        const units = safePacks * SIGNALS_OVERAGE_PACK_UNITS;
        const priceCents = safePacks * SIGNALS_OVERAGE_PACK_PRICE_CENTS;

        const purchase = await prisma.$transaction(async (tx) => {
            const org = await tx.organization.findUnique({
                where: { id: organizationId },
                select: { id: true },
            });
            if (!org) {
                throw new Error('Organization not found');
            }

            const created = await tx.planOveragePurchase.create({
                data: {
                    organizationId,
                    metric: 'signals_monthly',
                    unitsPurchased: units,
                    unitsRemaining: units,
                    priceCents,
                    currency: 'BRL',
                    effectiveFrom: now,
                    expiresAt: cycle.endsAt,
                    notes,
                    createdByUserId,
                },
            });

            await this.writeLedgerTx(tx, {
                organizationId,
                dimension: 'volume',
                metric: 'signals_monthly',
                operation: 'overage_purchase',
                units,
                metadata: {
                    packs: safePacks,
                    priceCents,
                    expiresAt: cycle.endsAt.toISOString(),
                },
            });

            return created;
        });

        return purchase;
    }

    async changePlan(
        organizationId: string,
        changedByUserId: string,
        toPlan: Plan,
        reason?: string,
        source: PlanChangeSource = PlanChangeSource.USER_ACTION
    ) {
        await prisma.$transaction(async (tx) => {
            const org = await tx.organization.findUnique({
                where: { id: organizationId },
                select: {
                    id: true,
                    plan: true,
                    planVersion: true,
                },
            });
            if (!org) {
                throw new Error('Organization not found');
            }

            if (org.plan === toPlan) {
                return;
            }

            const nextVersion = org.planVersion + 1;
            const legacy = toLegacyLimits(toPlan);

            await tx.organization.update({
                where: { id: organizationId },
                data: {
                    plan: toPlan,
                    planVersion: nextVersion,
                    ...legacy,
                },
            });

            await this.ensurePlanConfigTx(tx, organizationId, toPlan, new Date());

            await tx.planChangeAudit.create({
                data: {
                    organizationId,
                    fromPlan: org.plan,
                    toPlan,
                    source,
                    reason,
                    changedByUserId,
                    metadata: {
                        previousVersion: org.planVersion,
                        newVersion: nextVersion,
                    },
                },
            });
        });

        return this.getUsageSnapshot(organizationId);
    }
}

export const billingService = new BillingService();

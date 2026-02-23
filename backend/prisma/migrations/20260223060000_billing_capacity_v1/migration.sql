-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "planVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateEnum
CREATE TYPE "UsagePeriodType" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PlanChangeSource" AS ENUM ('USER_ACTION', 'ADMIN_ACTION', 'SYSTEM', 'MIGRATION');

-- CreateTable
CREATE TABLE "OrganizationPlanConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currentPlan" "Plan" NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "cycleStartedAt" TIMESTAMP(3),
    "cycleEndsAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationUsageCounter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "periodType" "UsagePeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "operationKey" TEXT,
    "periodType" "UsagePeriodType",
    "periodStart" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanOveragePurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metric" TEXT NOT NULL DEFAULT 'signals_monthly',
    "unitsPurchased" INTEGER NOT NULL,
    "unitsRemaining" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanOveragePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChangeAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromPlan" "Plan",
    "toPlan" "Plan" NOT NULL,
    "source" "PlanChangeSource" NOT NULL DEFAULT 'USER_ACTION',
    "reason" TEXT,
    "metadata" JSONB,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChangeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPlanConfig_organizationId_key" ON "OrganizationPlanConfig"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationPlanConfig_currentPlan_idx" ON "OrganizationPlanConfig"("currentPlan");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUsageCounter_organizationId_metric_periodType_periodStart_key" ON "OrganizationUsageCounter"("organizationId", "metric", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "OrganizationUsageCounter_organizationId_metric_periodType_idx" ON "OrganizationUsageCounter"("organizationId", "metric", "periodType");

-- CreateIndex
CREATE INDEX "OrganizationUsageCounter_organizationId_periodStart_idx" ON "OrganizationUsageCounter"("organizationId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLedger_operationKey_key" ON "UsageLedger"("operationKey");

-- CreateIndex
CREATE INDEX "UsageLedger_organizationId_metric_createdAt_idx" ON "UsageLedger"("organizationId", "metric", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLedger_organizationId_dimension_createdAt_idx" ON "UsageLedger"("organizationId", "dimension", "createdAt");

-- CreateIndex
CREATE INDEX "PlanOveragePurchase_organizationId_metric_expiresAt_idx" ON "PlanOveragePurchase"("organizationId", "metric", "expiresAt");

-- CreateIndex
CREATE INDEX "PlanOveragePurchase_organizationId_createdAt_idx" ON "PlanOveragePurchase"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanChangeAudit_organizationId_createdAt_idx" ON "PlanChangeAudit"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanChangeAudit_toPlan_createdAt_idx" ON "PlanChangeAudit"("toPlan", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationPlanConfig" ADD CONSTRAINT "OrganizationPlanConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUsageCounter" ADD CONSTRAINT "OrganizationUsageCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOveragePurchase" ADD CONSTRAINT "PlanOveragePurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOveragePurchase" ADD CONSTRAINT "PlanOveragePurchase_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChangeAudit" ADD CONSTRAINT "PlanChangeAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChangeAudit" ADD CONSTRAINT "PlanChangeAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

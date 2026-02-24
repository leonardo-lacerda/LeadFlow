-- CreateEnum
CREATE TYPE "AgentMode" AS ENUM ('ASSISTED', 'SUPERVISED', 'AUTONOMOUS');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('DRAFT', 'APPROVAL_REQUIRED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentDecisionRisk" AS ENUM ('LOW', 'HIGH');

-- CreateEnum
CREATE TYPE "AgentDecisionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AgentHandoffStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mode" "AgentMode" NOT NULL DEFAULT 'ASSISTED',
    "northStarMonthlyMeetings" INTEGER NOT NULL DEFAULT 10,
    "guardrails" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mode" "AgentMode" NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "goalSnapshot" JSONB,
    "inputSnapshot" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "risk" "AgentDecisionRisk" NOT NULL,
    "status" "AgentDecisionStatus" NOT NULL DEFAULT 'PROPOSED',
    "confidence" DOUBLE PRECISION,
    "actionKey" TEXT NOT NULL,
    "actionPayload" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentHandoff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT,
    "decisionId" TEXT,
    "leadId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "AgentHandoffStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "details" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_organizationId_key" ON "AgentConfig"("organizationId");

-- CreateIndex
CREATE INDEX "AgentConfig_mode_idx" ON "AgentConfig"("mode");

-- CreateIndex
CREATE INDEX "AgentRun_organizationId_createdAt_idx" ON "AgentRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_organizationId_status_createdAt_idx" ON "AgentRun"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentDecision_organizationId_risk_status_createdAt_idx" ON "AgentDecision"("organizationId", "risk", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentDecision_runId_status_idx" ON "AgentDecision"("runId", "status");

-- CreateIndex
CREATE INDEX "AgentHandoff_organizationId_status_createdAt_idx" ON "AgentHandoff"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentHandoff_runId_idx" ON "AgentHandoff"("runId");

-- CreateIndex
CREATE INDEX "AgentHandoff_leadId_idx" ON "AgentHandoff"("leadId");

-- AddForeignKey
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "AgentDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

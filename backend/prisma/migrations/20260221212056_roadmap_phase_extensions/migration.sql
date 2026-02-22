-- CreateEnum
CREATE TYPE "DraftFormat" AS ENUM ('TWEET', 'THREAD', 'CHART', 'MICRO_CASE', 'INSIGHT');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "networkOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SharedLead" (
    "id" TEXT NOT NULL,
    "googlePlaceId" TEXT,
    "companyCnpj" TEXT,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "fullName" TEXT,
    "companyName" TEXT,
    "website" TEXT,
    "city" TEXT,
    "state" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL,
    "rawData" JSONB,
    "quality" INTEGER NOT NULL DEFAULT 50,
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedLeadClaim" (
    "id" TEXT NOT NULL,
    "sharedLeadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedLeadClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signalId" TEXT,
    "format" "DraftFormat" NOT NULL,
    "content" TEXT NOT NULL,
    "editedContent" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "platform" TEXT,
    "impressions" INTEGER,
    "engagement" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedLead_googlePlaceId_key" ON "SharedLead"("googlePlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedLead_companyCnpj_key" ON "SharedLead"("companyCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "SharedLead_linkedinUrl_key" ON "SharedLead"("linkedinUrl");

-- CreateIndex
CREATE INDEX "SharedLead_city_state_category_idx" ON "SharedLead"("city", "state", "category");

-- CreateIndex
CREATE INDEX "SharedLead_source_idx" ON "SharedLead"("source");

-- CreateIndex
CREATE INDEX "SharedLead_lastScrapedAt_idx" ON "SharedLead"("lastScrapedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedLeadClaim_leadId_key" ON "SharedLeadClaim"("leadId");

-- CreateIndex
CREATE INDEX "SharedLeadClaim_organizationId_claimedAt_idx" ON "SharedLeadClaim"("organizationId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedLeadClaim_sharedLeadId_organizationId_key" ON "SharedLeadClaim"("sharedLeadId", "organizationId");

-- CreateIndex
CREATE INDEX "DistributionDraft_organizationId_status_idx" ON "DistributionDraft"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DistributionDraft_organizationId_format_idx" ON "DistributionDraft"("organizationId", "format");

-- CreateIndex
CREATE INDEX "DistributionDraft_signalId_idx" ON "DistributionDraft"("signalId");

-- CreateIndex
CREATE INDEX "DistributionDraft_publishedAt_idx" ON "DistributionDraft"("publishedAt");

-- AddForeignKey
ALTER TABLE "SharedLeadClaim" ADD CONSTRAINT "SharedLeadClaim_sharedLeadId_fkey" FOREIGN KEY ("sharedLeadId") REFERENCES "SharedLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedLeadClaim" ADD CONSTRAINT "SharedLeadClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedLeadClaim" ADD CONSTRAINT "SharedLeadClaim_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionDraft" ADD CONSTRAINT "DistributionDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionDraft" ADD CONSTRAINT "DistributionDraft_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

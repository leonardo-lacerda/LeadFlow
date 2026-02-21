-- CreateEnum
CREATE TYPE "SignalChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'MANUAL');

-- CreateEnum
CREATE TYPE "SignalEventType" AS ENUM (
    'MESSAGE_SENT',
    'MESSAGE_REPLY_RECEIVED',
    'MESSAGE_BOUNCED',
    'MESSAGE_FAILED',
    'MANUAL_TOUCHPOINT_CREATED'
);

-- CreateEnum
CREATE TYPE "SignalEventOutcome" AS ENUM ('SENT', 'REPLIED', 'BOUNCED', 'FAILED', 'MANUAL');

-- CreateTable
CREATE TABLE "SignalEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "campaignId" TEXT,
    "eventType" "SignalEventType" NOT NULL,
    "channel" "SignalChannel" NOT NULL,
    "outcome" "SignalEventOutcome" NOT NULL,
    "leadSegment" TEXT,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalEvent_dedupeKey_key" ON "SignalEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "SignalEvent_organizationId_eventAt_idx" ON "SignalEvent"("organizationId", "eventAt");

-- CreateIndex
CREATE INDEX "SignalEvent_leadId_eventAt_idx" ON "SignalEvent"("leadId", "eventAt");

-- CreateIndex
CREATE INDEX "SignalEvent_campaignId_eventAt_idx" ON "SignalEvent"("campaignId", "eventAt");

-- CreateIndex
CREATE INDEX "SignalEvent_leadSegment_eventAt_idx" ON "SignalEvent"("leadSegment", "eventAt");

-- CreateIndex
CREATE INDEX "SignalEvent_channel_eventType_eventAt_idx" ON "SignalEvent"("channel", "eventType", "eventAt");

-- AddForeignKey
ALTER TABLE "SignalEvent" ADD CONSTRAINT "SignalEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalEvent" ADD CONSTRAINT "SignalEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalEvent" ADD CONSTRAINT "SignalEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
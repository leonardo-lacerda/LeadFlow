-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN     "lastMetricsAt" TIMESTAMP(3),
ADD COLUMN     "metrics" JSONB;

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN     "campaignStepId" TEXT,
ADD COLUMN     "responseTime" INTEGER;

-- CreateIndex
CREATE INDEX "Campaign_lastMetricsAt_idx" ON "Campaign"("lastMetricsAt");

-- CreateIndex
CREATE INDEX "Message_campaignStepId_idx" ON "Message"("campaignStepId");

-- CreateIndex
CREATE INDEX "Message_responseTime_idx" ON "Message"("responseTime");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_campaignStepId_fkey" FOREIGN KEY ("campaignStepId") REFERENCES "CampaignStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

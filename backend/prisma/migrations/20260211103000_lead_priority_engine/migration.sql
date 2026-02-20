-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('HOT', 'WARM', 'COLD');

-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN     "temperature" "LeadTemperature" NOT NULL DEFAULT 'COLD',
ADD COLUMN     "lastInteraction" TIMESTAMP(3),
ADD COLUMN     "lastScoreUpdate" TIMESTAMP(3),
ADD COLUMN     "scoreBreakdown" JSONB;

-- CreateIndex
CREATE INDEX "Lead_temperature_idx" ON "Lead"("temperature");

-- CreateIndex
CREATE INDEX "Lead_lastInteraction_idx" ON "Lead"("lastInteraction");

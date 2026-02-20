-- CreateEnum
CREATE TYPE "MaturityLevel" AS ENUM ('EARLY_STAGE', 'GROWING', 'ESTABLISHED', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN     "companyRevenue" TEXT,
ADD COLUMN     "companyEmployees" TEXT,
ADD COLUMN     "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "maturityLevel" "MaturityLevel",
ADD COLUMN     "icpReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Lead_maturityLevel_idx" ON "Lead"("maturityLevel");

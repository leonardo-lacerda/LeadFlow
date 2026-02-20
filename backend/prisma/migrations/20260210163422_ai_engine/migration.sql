-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('SCORING', 'GENERATION', 'ANALYSIS');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "icpDefinition" JSONB;

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AiJobType" NOT NULL DEFAULT 'SCORING',
    "query" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB,
    "errors" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiJob_organizationId_idx" ON "AiJob"("organizationId");

-- CreateIndex
CREATE INDEX "AiJob_status_idx" ON "AiJob"("status");

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

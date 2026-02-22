-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('TIMING', 'CHANNEL', 'ICP', 'MESSAGE', 'OBJECTION', 'CONVERSION');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('NEW', 'SEEN', 'USED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "insight" TEXT NOT NULL,
    "dataPoints" INTEGER NOT NULL,
    "suggestedFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawData" JSONB NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Signal_organizationId_type_idx" ON "Signal"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_organizationId_signature_key" ON "Signal"("organizationId", "signature");

-- CreateIndex
CREATE INDEX "Signal_organizationId_status_idx" ON "Signal"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Signal_confidence_idx" ON "Signal"("confidence");

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

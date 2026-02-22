-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('TWITTER', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "SocialPublishStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "SocialPublishJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "draftId" TEXT,
    "platform" "SocialPlatform" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SocialPublishStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "externalPostId" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPublishJob_organizationId_status_createdAt_idx" ON "SocialPublishJob"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPublishJob_organizationId_platform_createdAt_idx" ON "SocialPublishJob"("organizationId", "platform", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPublishJob_draftId_idx" ON "SocialPublishJob"("draftId");

-- AddForeignKey
ALTER TABLE "SocialPublishJob" ADD CONSTRAINT "SocialPublishJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPublishJob" ADD CONSTRAINT "SocialPublishJob_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DistributionDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

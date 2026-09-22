-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "autoApproveReviews" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MealReview" ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "reply" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "MealReview_businessId_status_idx" ON "MealReview"("businessId", "status");

-- Backfill: existing reviews were already public (aggregated stars); keep them visible under the new approved-only rule.
UPDATE "MealReview" SET "status" = 'approved';

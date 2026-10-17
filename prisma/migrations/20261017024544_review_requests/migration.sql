-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "googleReviewUrl" TEXT,
ADD COLUMN     "notifyReviewRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewRequestDays" INTEGER NOT NULL DEFAULT 2;

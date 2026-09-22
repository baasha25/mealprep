-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "adminMinutesPerOrder" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "notifyAbandoned" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWinBack" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "winBackCouponCode" TEXT,
ADD COLUMN     "winBackDays" INTEGER NOT NULL DEFAULT 45;

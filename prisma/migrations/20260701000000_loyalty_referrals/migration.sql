-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "loyaltyPointsPerDollar" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "loyaltyRedeemCentsPerPoint" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "referralBonusPoints" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_referralCode_key" ON "Customer"("businessId", "referralCode");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


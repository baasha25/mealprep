-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "subNoPick" TEXT NOT NULL DEFAULT 'skip',
ADD COLUMN     "subscriptionsOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "stripeFeeItemId" TEXT,
ADD COLUMN     "zone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_subscriptionId_deliveryDate_key" ON "Order"("subscriptionId", "deliveryDate");


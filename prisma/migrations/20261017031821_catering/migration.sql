-- CreateEnum
CREATE TYPE "CateringStatus" AS ENUM ('requested', 'quoted', 'approved', 'paid', 'declined');

-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'catering';

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "cateringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cateringIntro" TEXT,
ADD COLUMN     "cateringLeadDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "cateringMinMeals" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "CateringRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "token" TEXT NOT NULL,
    "status" "CateringStatus" NOT NULL DEFAULT 'requested',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventTime" TEXT,
    "headcount" INTEGER,
    "fulfillment" "Fulfillment" NOT NULL DEFAULT 'delivery',
    "address" TEXT,
    "notes" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "ownerNote" TEXT,
    "declineReason" TEXT,
    "quotedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CateringRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CateringRequest_token_key" ON "CateringRequest"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CateringRequest_orderId_key" ON "CateringRequest"("orderId");

-- CreateIndex
CREATE INDEX "CateringRequest_businessId_status_idx" ON "CateringRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "CateringRequest_businessId_eventDate_idx" ON "CateringRequest"("businessId", "eventDate");

-- AddForeignKey
ALTER TABLE "CateringRequest" ADD CONSTRAINT "CateringRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringRequest" ADD CONSTRAINT "CateringRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CateringRequest" ADD CONSTRAINT "CateringRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

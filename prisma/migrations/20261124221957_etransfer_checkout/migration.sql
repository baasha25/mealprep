-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "etransferEmail" TEXT,
ADD COLUMN     "etransferEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "etransferHoldHours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "etransferNote" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" TEXT;


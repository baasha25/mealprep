-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "extrasCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extrasCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeInvoiceItemId" TEXT;


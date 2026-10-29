-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "importBatchId" TEXT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'orders',
    "fileName" TEXT,
    "source" TEXT,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "firstDate" TIMESTAMP(3),
    "lastDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_businessId_idx" ON "ImportBatch"("businessId");

-- CreateIndex
CREATE INDEX "Order_importBatchId_idx" ON "Order"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_externalRef_key" ON "Order"("businessId", "externalRef");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;


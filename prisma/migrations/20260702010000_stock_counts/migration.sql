-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "expectedQty" DOUBLE PRECISION NOT NULL,
    "countedQty" DOUBLE PRECISION NOT NULL,
    "varianceQty" DOUBLE PRECISION NOT NULL,
    "varianceCents" INTEGER NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCount_businessId_idx" ON "StockCount"("businessId");

-- CreateIndex
CREATE INDEX "StockCount_ingredientId_idx" ON "StockCount"("ingredientId");

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;


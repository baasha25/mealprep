-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "IngredientReceipt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "qtyReceived" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngredientReceipt_businessId_idx" ON "IngredientReceipt"("businessId");

-- CreateIndex
CREATE INDEX "IngredientReceipt_ingredientId_idx" ON "IngredientReceipt"("ingredientId");

-- AddForeignKey
ALTER TABLE "IngredientReceipt" ADD CONSTRAINT "IngredientReceipt_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;


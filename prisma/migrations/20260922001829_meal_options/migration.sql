-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "optionsKey" TEXT,
ADD COLUMN     "optionsSnapshot" JSONB;

-- AlterTable
ALTER TABLE "SubscriptionSelectionItem" ADD COLUMN     "optionsKey" TEXT,
ADD COLUMN     "optionsSnapshot" JSONB;

-- CreateTable
CREATE TABLE "MealOptionGroup" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 1,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MealOptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MealOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealOptionIngredient" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "trimBps" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MealOptionIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealOptionGroup_mealId_idx" ON "MealOptionGroup"("mealId");

-- CreateIndex
CREATE INDEX "MealOption_groupId_idx" ON "MealOption"("groupId");

-- CreateIndex
CREATE INDEX "MealOptionIngredient_optionId_idx" ON "MealOptionIngredient"("optionId");

-- CreateIndex
CREATE INDEX "MealOptionIngredient_ingredientId_idx" ON "MealOptionIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "MealOptionIngredient_optionId_ingredientId_key" ON "MealOptionIngredient"("optionId", "ingredientId");

-- AddForeignKey
ALTER TABLE "MealOptionGroup" ADD CONSTRAINT "MealOptionGroup_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOption" ADD CONSTRAINT "MealOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MealOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOptionIngredient" ADD CONSTRAINT "MealOptionIngredient_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MealOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealOptionIngredient" ADD CONSTRAINT "MealOptionIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

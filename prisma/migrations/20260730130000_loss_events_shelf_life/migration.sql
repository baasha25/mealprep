-- Reason-coded food loss (spoilage, dropped in transit, remakes, pests, ...)
-- plus shelf-life fields, so P&L can account for food paid-for-but-not-sold.

-- Enums
CREATE TYPE "LossKind" AS ENUM ('ingredient', 'meal');
CREATE TYPE "LossReason" AS ENUM ('spoilage', 'dropped_in_transit', 'order_error', 'pest', 'remake', 'expired', 'other');

-- Shelf life
ALTER TABLE "Meal" ADD COLUMN "shelfLifeDays" INTEGER;
ALTER TABLE "Ingredient" ADD COLUMN "shelfLifeDays" INTEGER;

-- Loss events
CREATE TABLE "LossEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "LossKind" NOT NULL,
    "reason" "LossReason" NOT NULL,
    "mealId" TEXT,
    "ingredientId" TEXT,
    "orderId" TEXT,
    "itemName" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "costCents" INTEGER NOT NULL,
    "restockedFromInventory" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LossEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LossEvent_businessId_idx" ON "LossEvent"("businessId");
CREATE INDEX "LossEvent_orderId_idx" ON "LossEvent"("orderId");
CREATE INDEX "LossEvent_businessId_createdAt_idx" ON "LossEvent"("businessId", "createdAt");

-- CreateTable
CREATE TABLE "MealReview" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealReview_businessId_idx" ON "MealReview"("businessId");

-- CreateIndex
CREATE INDEX "MealReview_mealId_idx" ON "MealReview"("mealId");

-- CreateIndex
CREATE UNIQUE INDEX "MealReview_mealId_customerId_key" ON "MealReview"("mealId", "customerId");

-- AddForeignKey
ALTER TABLE "MealReview" ADD CONSTRAINT "MealReview_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealReview" ADD CONSTRAINT "MealReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


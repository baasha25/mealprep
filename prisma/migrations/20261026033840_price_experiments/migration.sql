-- CreateTable
CREATE TABLE "PriceExperiment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "testPriceCents" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3) NOT NULL,
    "baselineUnits" INTEGER NOT NULL,
    "baselineDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceExperiment_businessId_status_idx" ON "PriceExperiment"("businessId", "status");

-- CreateIndex
CREATE INDEX "PriceExperiment_mealId_idx" ON "PriceExperiment"("mealId");

-- AddForeignKey
ALTER TABLE "PriceExperiment" ADD CONSTRAINT "PriceExperiment_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


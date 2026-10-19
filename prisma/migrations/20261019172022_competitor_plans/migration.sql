-- CreateTable
CREATE TABLE "CompetitorPlan" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "mealsPerWeek" INTEGER NOT NULL,
    "perMealCents" INTEGER NOT NULL,
    "deliveryFeeCents" INTEGER,
    "label" TEXT,
    "startingFrom" BOOLEAN NOT NULL DEFAULT false,
    "estimated" BOOLEAN NOT NULL DEFAULT true,
    "url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorPlan_competitorId_idx" ON "CompetitorPlan"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorPlan_competitorId_mealsPerWeek_key" ON "CompetitorPlan"("competitorId", "mealsPerWeek");

-- AddForeignKey
ALTER TABLE "CompetitorPlan" ADD CONSTRAINT "CompetitorPlan_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

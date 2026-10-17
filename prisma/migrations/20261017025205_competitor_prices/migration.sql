-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorItem" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "url" TEXT,
    "portion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorMatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "competitorItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competitor_businessId_idx" ON "Competitor"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_businessId_domain_key" ON "Competitor"("businessId", "domain");

-- CreateIndex
CREATE INDEX "CompetitorItem_competitorId_idx" ON "CompetitorItem"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorItem_competitorId_externalId_key" ON "CompetitorItem"("competitorId", "externalId");

-- CreateIndex
CREATE INDEX "CompetitorMatch_businessId_status_idx" ON "CompetitorMatch"("businessId", "status");

-- CreateIndex
CREATE INDEX "CompetitorMatch_mealId_idx" ON "CompetitorMatch"("mealId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorMatch_mealId_competitorItemId_key" ON "CompetitorMatch"("mealId", "competitorItemId");

-- AddForeignKey
ALTER TABLE "CompetitorItem" ADD CONSTRAINT "CompetitorItem_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorMatch" ADD CONSTRAINT "CompetitorMatch_competitorItemId_fkey" FOREIGN KEY ("competitorItemId") REFERENCES "CompetitorItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CspReport" (
    "id" TEXT NOT NULL,
    "documentPath" TEXT NOT NULL,
    "directive" TEXT NOT NULL,
    "blockedUri" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "sample" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CspReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CspReport_lastSeenAt_idx" ON "CspReport"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "CspReport_documentPath_directive_blockedUri_key" ON "CspReport"("documentPath", "directive", "blockedUri");

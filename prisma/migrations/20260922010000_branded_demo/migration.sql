-- AlterTable: branded, reusable prospect demos
ALTER TABLE "Business" ADD COLUMN "demoKey" TEXT,
ADD COLUMN "demoExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Business_demoKey_key" ON "Business"("demoKey");

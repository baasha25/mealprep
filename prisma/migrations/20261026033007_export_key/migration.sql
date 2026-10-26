-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "exportKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_exportKey_key" ON "BusinessSettings"("exportKey");


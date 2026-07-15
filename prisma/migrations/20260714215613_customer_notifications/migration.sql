-- Customer notification toggles + idempotency log for scheduled reminders.
ALTER TABLE "BusinessSettings" ADD COLUMN "notifyCutoff" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BusinessSettings" ADD COLUMN "notifyDeliveryDay" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SentNotification" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "forDate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SentNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SentNotification_type_targetId_forDate_key" ON "SentNotification"("type", "targetId", "forDate");
CREATE INDEX "SentNotification_businessId_idx" ON "SentNotification"("businessId");

-- 30-day free trial clock for each kitchen. Informational until kitchen billing
-- is wired (no lockout yet). Backfill existing kitchens to createdAt + 30 days.
ALTER TABLE "Business" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
UPDATE "Business" SET "trialEndsAt" = "createdAt" + INTERVAL '30 days' WHERE "trialEndsAt" IS NULL;

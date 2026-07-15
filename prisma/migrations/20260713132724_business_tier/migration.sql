-- PrepFlow platform subscription tier for a kitchen (drives the platform fee).
CREATE TYPE "BusinessTier" AS ENUM ('starter', 'growth', 'pro');
ALTER TABLE "Business" ADD COLUMN "tier" "BusinessTier" NOT NULL DEFAULT 'starter';

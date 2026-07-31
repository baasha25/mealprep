-- Software billing (kitchen pays PrepFlow) on the platform Stripe account.
CREATE TYPE "BillingStatus" AS ENUM ('none', 'active', 'past_due', 'canceled');
ALTER TABLE "Business" ADD COLUMN "billingCustomerId" TEXT;
ALTER TABLE "Business" ADD COLUMN "billingSubscriptionId" TEXT;
ALTER TABLE "Business" ADD COLUMN "billingStatus" "BillingStatus" NOT NULL DEFAULT 'none';
ALTER TABLE "Business" ADD COLUMN "billingComped" BOOLEAN NOT NULL DEFAULT false;

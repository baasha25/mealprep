-- Track whether Stripe has cleared a connected account to take payments.
ALTER TABLE "Business" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;

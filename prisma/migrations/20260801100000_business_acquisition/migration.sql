-- First-touch acquisition attribution captured at signup.
ALTER TABLE "Business" ADD COLUMN "acqSource" TEXT;
ALTER TABLE "Business" ADD COLUMN "acqMedium" TEXT;
ALTER TABLE "Business" ADD COLUMN "acqCampaign" TEXT;
ALTER TABLE "Business" ADD COLUMN "acqReferrer" TEXT;

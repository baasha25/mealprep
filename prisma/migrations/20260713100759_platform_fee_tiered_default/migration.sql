-- Platform fee: adopt the tiered pricing model.
-- New default is the Starter-tier entry rate of 1.5% (150 bps).
-- Growth = 1.25% (125), Pro = 1.0% (100) are set per-kitchen in Settings.
-- Previously: 0 (self-serve kitchens onboarded charging us nothing) or 200 (old 2% placeholder).
ALTER TABLE "BusinessSettings" ALTER COLUMN "platformFeeBps" SET DEFAULT 150;

-- Move existing kitchens off the placeholder/unset values onto the Starter rate.
-- (Only touches the old default values; a kitchen with a deliberately-set custom fee is left alone.)
UPDATE "BusinessSettings" SET "platformFeeBps" = 150 WHERE "platformFeeBps" IN (0, 200);

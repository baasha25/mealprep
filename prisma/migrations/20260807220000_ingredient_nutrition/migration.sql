-- Per-unit nutrition so a meal's macros can auto-sum from its recipe ingredients.
ALTER TABLE "Ingredient" ADD COLUMN "calPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN "proteinPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN "carbsPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Ingredient" ADD COLUMN "fatPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0;

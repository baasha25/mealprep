-- Optional per-ingredient density (grams per ml) so a recipe can use a volume
-- unit for an ingredient priced by weight (and vice-versa).
ALTER TABLE "Ingredient" ADD COLUMN "densityGPerMl" DOUBLE PRECISION;

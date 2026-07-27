-- Per-ingredient low-stock reorder threshold (0 = disabled).
ALTER TABLE "Ingredient" ADD COLUMN "reorderThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0;

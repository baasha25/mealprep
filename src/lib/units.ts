// Unit conversion for recipe costing. An ingredient is bought/priced in ONE unit
// (its purchase unit, e.g. "lb"); a recipe can call for it in ANY unit (e.g. "oz"
// or "cup"). To cost a plate correctly we convert the recipe quantity into the
// ingredient's purchase unit before multiplying by cost/unit.
//
// Weight units resolve to grams, volume units to millilitres, count stays count.
// Same-dimension conversions are exact. Weight<->volume needs the ingredient's
// density (grams per ml), because a cup of oil and a cup of flour weigh
// differently — without it, the two units simply don't convert.

type Dimension = "weight" | "volume" | "count";

// Base = grams (weight) / millilitres (volume). Factors are exact-enough for food.
const DEF: Record<string, { dim: Dimension; base: number }> = {
  g: { dim: "weight", base: 1 },
  kg: { dim: "weight", base: 1000 },
  oz: { dim: "weight", base: 28.349523 },
  lb: { dim: "weight", base: 453.59237 },
  ml: { dim: "volume", base: 1 },
  l: { dim: "volume", base: 1000 },
  tsp: { dim: "volume", base: 4.9289216 },
  tbsp: { dim: "volume", base: 14.7867648 },
  cup: { dim: "volume", base: 236.588236 },
  gal: { dim: "volume", base: 3785.411784 },
  ea: { dim: "count", base: 1 },
};

const norm = (u: string) => (u || "").trim().toLowerCase();

export function dimensionOf(unit: string): Dimension | null {
  return DEF[norm(unit)]?.dim ?? null;
}

/**
 * Convert `qty` from one unit to another. Returns null when the units can't be
 * reconciled (unknown unit, or weight<->volume with no density). `densityGPerMl`
 * is grams per millilitre for the ingredient (only needed to cross weight/volume).
 */
export function convertQty(
  qty: number,
  from: string,
  to: string,
  densityGPerMl?: number | null,
): number | null {
  const f = DEF[norm(from)];
  const t = DEF[norm(to)];
  if (!f || !t) return null;
  if (norm(from) === norm(to)) return qty;
  if (f.dim === t.dim) return (qty * f.base) / t.base;

  // Cross weight <-> volume via density (g per ml).
  if (densityGPerMl && densityGPerMl > 0) {
    if (f.dim === "weight" && t.dim === "volume") {
      const grams = qty * f.base;
      return grams / densityGPerMl / t.base; // ml → target volume unit
    }
    if (f.dim === "volume" && t.dim === "weight") {
      const ml = qty * f.base;
      return (ml * densityGPerMl) / t.base; // g → target weight unit
    }
  }
  return null; // e.g. count<->anything, or weight<->volume without density
}

/** True if the two units can be reconciled (optionally with a density). */
export function canConvert(from: string, to: string, densityGPerMl?: number | null): boolean {
  return convertQty(1, from, to, densityGPerMl) !== null;
}

/**
 * A recipe quantity expressed in the ingredient's purchase unit (so cost/stock
 * math is correct). If the units can't be converted, falls back to the raw qty
 * (ok:false) so nothing crashes — the UI flags the mismatch instead.
 */
export function toPurchaseQty(
  qty: number,
  recipeUnit: string,
  purchaseUnit: string,
  densityGPerMl?: number | null,
): { qty: number; ok: boolean } {
  const c = convertQty(qty, recipeUnit, purchaseUnit, densityGPerMl);
  return c === null ? { qty, ok: false } : { qty: c, ok: true };
}

/** Convert a friendly "grams per cup" pantry figure into density (g per ml). */
export function densityFromGramsPerCup(gramsPerCup: number): number | null {
  if (!(gramsPerCup > 0)) return null;
  return gramsPerCup / DEF.cup.base;
}

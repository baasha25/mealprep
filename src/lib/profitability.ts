// Menu profitability engine — costs every plate from its recipe (incl. trim),
// derives margin, and classifies the menu. Pure integer-cents math (§9).

import { toPurchaseQty } from "@/lib/units";

export type RecipeCostLine = { qty: number; trimBps: number; costPerUnitCents: number };

/**
 * True cost to produce one plate: each ingredient grossed up for its trim
 * (you pay for what you trim away), valued at its cost/unit. `qty` must already
 * be in the ingredient's cost unit — use `plateCostFromRecipe` to convert.
 */
export function plateCostCents(lines: RecipeCostLine[]): number {
  let total = 0;
  for (const l of lines) {
    const trim = Math.min(Math.max(l.trimBps, 0), 9999) / 10000;
    total += (l.qty / (1 - trim)) * l.costPerUnitCents;
  }
  return Math.round(total);
}

export type RecipeSource = {
  qty: number;
  unit: string;
  trimBps: number;
  ingredient: { unit: string; costPerUnitCents: number; densityGPerMl?: number | null };
};

/**
 * Plate cost straight from recipe rows — converts each recipe quantity into the
 * ingredient's purchase unit first (8 oz of a $/lb ingredient becomes 0.5 lb),
 * so cost/unit finally lines up. Unconvertible units fall back to raw qty (the
 * recipe editor warns about those).
 */
export function plateCostFromRecipe(lines: RecipeSource[]): number {
  return plateCostCents(
    lines.map((l) => ({
      qty: toPurchaseQty(l.qty, l.unit, l.ingredient.unit, l.ingredient.densityGPerMl).qty,
      trimBps: l.trimBps,
      costPerUnitCents: l.ingredient.costPerUnitCents,
    })),
  );
}

export type MealEconomics = {
  marginCents: number; // price − plate cost
  marginBps: number; // margin as a share of price
  foodCostBps: number; // plate cost as a share of price
  losing: boolean; // costs more to make than it sells for
};

export function mealEconomics(priceCents: number, plateCost: number): MealEconomics {
  const marginCents = priceCents - plateCost;
  return {
    marginCents,
    marginBps: priceCents > 0 ? Math.round((marginCents / priceCents) * 10000) : 0,
    foodCostBps: priceCents > 0 ? Math.round((plateCost / priceCents) * 10000) : 0,
    losing: marginCents < 0,
  };
}

// Menu-engineering quadrant: profitability (margin) × popularity (units sold).
export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";
export const MENU_CLASS_LABEL: Record<MenuClass, string> = {
  star: "Star",
  plowhorse: "Plowhorse",
  puzzle: "Puzzle",
  dog: "Dog",
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Classify each meal vs the menu's median margin and median popularity. */
export function classifyMenu<T extends { marginBps: number; units: number }>(
  items: T[],
): (T & { menuClass: MenuClass })[] {
  const medMargin = median(items.map((i) => i.marginBps));
  const medUnits = median(items.map((i) => i.units));
  return items.map((i) => {
    const hiMargin = i.marginBps >= medMargin;
    const hiPop = i.units >= medUnits;
    const menuClass: MenuClass = hiMargin && hiPop ? "star" : !hiMargin && hiPop ? "plowhorse" : hiMargin ? "puzzle" : "dog";
    return { ...i, menuClass };
  });
}

/** % change between an old and new cost, in basis points (+ is a rise). */
export function priceChangeBps(oldCents: number, newCents: number): number {
  if (oldCents <= 0) return 0;
  return Math.round(((newCents - oldCents) / oldCents) * 10000);
}

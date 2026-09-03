// Shared nutrition library — a platform-level catalog of common ingredients with
// verified per-100 g macros, so kitchens don't hand-type calories/protein/carbs/
// fat for every ingredient. It's the same data for every tenant (a static module
// is shared by definition); the DB/USDA-FoodData-Central path can extend it later.
//
// Values are per 100 g of the edible portion (raw unless noted), rounded from
// USDA FoodData Central. Treat this as a STARTER SET to verify and expand.
// Macros are stored on an ingredient PER ITS UNIT, so we convert per-100 g into
// the kitchen's chosen unit (weight direct, volume via density, count via
// gramsPerEach) — mirroring how plate-cost converts units.

import { convertQty } from "@/lib/units";
import type { Macros } from "@/lib/nutrition";

export type Per100g = { cal: number; proteinG: number; carbsG: number; fatG: number };

export type LibraryIngredient = {
  id: string;
  name: string;
  category: string;
  per100g: Per100g;
  /** grams per millilitre — lets a volume unit (cup/ml/l) convert from per-100 g. */
  densityGPerMl?: number;
  /** grams of one piece — lets a count unit ("ea", e.g. an egg) convert. */
  gramsPerEach?: number;
  /** the unit kitchens usually buy this in — pre-selected on pick. */
  defaultUnit?: string;
  aliases?: string[];
};

// prettier-ignore
export const NUTRITION_LIBRARY: LibraryIngredient[] = [
  // ---- Proteins (raw, edible portion) ----
  { id: "chicken-breast", name: "Chicken breast (skinless)", category: "Protein", per100g: { cal: 120, proteinG: 22.5, carbsG: 0, fatG: 2.6 }, defaultUnit: "lb", aliases: ["chicken", "chix breast"] },
  { id: "chicken-thigh", name: "Chicken thigh (boneless, skinless)", category: "Protein", per100g: { cal: 121, proteinG: 19.7, carbsG: 0, fatG: 4.1 }, defaultUnit: "lb", aliases: ["thigh"] },
  { id: "ground-beef-85", name: "Ground beef (85% lean)", category: "Protein", per100g: { cal: 215, proteinG: 18.6, carbsG: 0, fatG: 15 }, defaultUnit: "lb", aliases: ["beef", "mince"] },
  { id: "ground-turkey-93", name: "Ground turkey (93% lean)", category: "Protein", per100g: { cal: 150, proteinG: 18.7, carbsG: 0, fatG: 8.3 }, defaultUnit: "lb", aliases: ["turkey"] },
  { id: "pork-tenderloin", name: "Pork tenderloin", category: "Protein", per100g: { cal: 120, proteinG: 20.7, carbsG: 0, fatG: 3.5 }, defaultUnit: "lb" },
  { id: "salmon", name: "Salmon (Atlantic)", category: "Protein", per100g: { cal: 208, proteinG: 20, carbsG: 0, fatG: 13 }, defaultUnit: "lb" },
  { id: "tilapia", name: "Tilapia", category: "Protein", per100g: { cal: 96, proteinG: 20.1, carbsG: 0, fatG: 1.7 }, defaultUnit: "lb" },
  { id: "shrimp", name: "Shrimp", category: "Protein", per100g: { cal: 85, proteinG: 20, carbsG: 0, fatG: 1 }, defaultUnit: "lb", aliases: ["prawns"] },
  { id: "tuna-canned", name: "Tuna (canned in water)", category: "Protein", per100g: { cal: 116, proteinG: 26, carbsG: 0, fatG: 0.8 }, defaultUnit: "lb" },
  { id: "egg", name: "Egg (whole)", category: "Protein", per100g: { cal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 }, gramsPerEach: 50, defaultUnit: "ea", aliases: ["eggs"] },
  { id: "tofu-firm", name: "Tofu (firm)", category: "Protein", per100g: { cal: 144, proteinG: 15.8, carbsG: 4.3, fatG: 8.7 }, defaultUnit: "lb" },
  { id: "tempeh", name: "Tempeh", category: "Protein", per100g: { cal: 192, proteinG: 20.3, carbsG: 7.6, fatG: 10.8 }, defaultUnit: "lb" },

  // ---- Grains & starches (dry unless noted) ----
  { id: "rice-white", name: "White rice (dry)", category: "Grain", per100g: { cal: 365, proteinG: 7.1, carbsG: 80, fatG: 0.7 }, defaultUnit: "lb", aliases: ["rice"] },
  { id: "rice-brown", name: "Brown rice (dry)", category: "Grain", per100g: { cal: 370, proteinG: 7.9, carbsG: 77.2, fatG: 2.9 }, defaultUnit: "lb" },
  { id: "quinoa", name: "Quinoa (dry)", category: "Grain", per100g: { cal: 368, proteinG: 14.1, carbsG: 64.2, fatG: 6.1 }, densityGPerMl: 0.76, defaultUnit: "lb" },
  { id: "oats", name: "Rolled oats (dry)", category: "Grain", per100g: { cal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5 }, densityGPerMl: 0.38, defaultUnit: "lb" },
  { id: "pasta-dry", name: "Pasta (dry)", category: "Grain", per100g: { cal: 371, proteinG: 13, carbsG: 74.7, fatG: 1.5 }, defaultUnit: "lb" },
  { id: "couscous", name: "Couscous (dry)", category: "Grain", per100g: { cal: 376, proteinG: 12.8, carbsG: 77.4, fatG: 0.6 }, defaultUnit: "lb" },
  { id: "bread-ww", name: "Whole wheat bread", category: "Grain", per100g: { cal: 247, proteinG: 13, carbsG: 41, fatG: 3.4 }, defaultUnit: "lb" },
  { id: "sweet-potato", name: "Sweet potato", category: "Vegetable", per100g: { cal: 86, proteinG: 1.6, carbsG: 20.1, fatG: 0.1 }, defaultUnit: "lb" },
  { id: "potato", name: "Potato", category: "Vegetable", per100g: { cal: 77, proteinG: 2, carbsG: 17.5, fatG: 0.1 }, defaultUnit: "lb" },

  // ---- Legumes ----
  { id: "black-beans", name: "Black beans (canned, drained)", category: "Legume", per100g: { cal: 91, proteinG: 6, carbsG: 16, fatG: 0.3 }, defaultUnit: "lb" },
  { id: "chickpeas", name: "Chickpeas (canned, drained)", category: "Legume", per100g: { cal: 139, proteinG: 7.4, carbsG: 22.5, fatG: 2.6 }, defaultUnit: "lb", aliases: ["garbanzo"] },
  { id: "lentils-dry", name: "Lentils (dry)", category: "Legume", per100g: { cal: 352, proteinG: 24.6, carbsG: 63.4, fatG: 1.1 }, defaultUnit: "lb" },

  // ---- Vegetables (raw) ----
  { id: "broccoli", name: "Broccoli", category: "Vegetable", per100g: { cal: 34, proteinG: 2.8, carbsG: 6.6, fatG: 0.4 }, defaultUnit: "lb" },
  { id: "spinach", name: "Spinach", category: "Vegetable", per100g: { cal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4 }, defaultUnit: "lb" },
  { id: "kale", name: "Kale", category: "Vegetable", per100g: { cal: 49, proteinG: 4.3, carbsG: 8.8, fatG: 0.9 }, defaultUnit: "lb" },
  { id: "bell-pepper", name: "Bell pepper", category: "Vegetable", per100g: { cal: 31, proteinG: 1, carbsG: 6, fatG: 0.3 }, defaultUnit: "lb", aliases: ["capsicum"] },
  { id: "onion", name: "Onion", category: "Vegetable", per100g: { cal: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1 }, defaultUnit: "lb" },
  { id: "carrot", name: "Carrot", category: "Vegetable", per100g: { cal: 41, proteinG: 0.9, carbsG: 9.6, fatG: 0.2 }, defaultUnit: "lb" },
  { id: "zucchini", name: "Zucchini", category: "Vegetable", per100g: { cal: 17, proteinG: 1.2, carbsG: 3.1, fatG: 0.3 }, defaultUnit: "lb", aliases: ["courgette"] },
  { id: "tomato", name: "Tomato", category: "Vegetable", per100g: { cal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2 }, defaultUnit: "lb" },
  { id: "cauliflower", name: "Cauliflower", category: "Vegetable", per100g: { cal: 25, proteinG: 1.9, carbsG: 5, fatG: 0.3 }, defaultUnit: "lb" },
  { id: "mushroom", name: "Mushroom", category: "Vegetable", per100g: { cal: 22, proteinG: 3.1, carbsG: 3.3, fatG: 0.3 }, defaultUnit: "lb" },
  { id: "green-beans", name: "Green beans", category: "Vegetable", per100g: { cal: 31, proteinG: 1.8, carbsG: 7, fatG: 0.2 }, defaultUnit: "lb" },
  { id: "asparagus", name: "Asparagus", category: "Vegetable", per100g: { cal: 20, proteinG: 2.2, carbsG: 3.9, fatG: 0.1 }, defaultUnit: "lb" },
  { id: "cucumber", name: "Cucumber", category: "Vegetable", per100g: { cal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1 }, defaultUnit: "lb" },
  { id: "corn", name: "Sweet corn", category: "Vegetable", per100g: { cal: 86, proteinG: 3.3, carbsG: 19, fatG: 1.4 }, defaultUnit: "lb" },
  { id: "avocado", name: "Avocado", category: "Vegetable", per100g: { cal: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7 }, defaultUnit: "lb" },
  { id: "garlic", name: "Garlic", category: "Vegetable", per100g: { cal: 149, proteinG: 6.4, carbsG: 33, fatG: 0.5 }, defaultUnit: "lb" },

  // ---- Dairy ----
  { id: "milk-2", name: "Milk (2%)", category: "Dairy", per100g: { cal: 50, proteinG: 3.3, carbsG: 4.8, fatG: 2 }, densityGPerMl: 1.03, defaultUnit: "l" },
  { id: "greek-yogurt", name: "Greek yogurt (plain, nonfat)", category: "Dairy", per100g: { cal: 59, proteinG: 10.2, carbsG: 3.6, fatG: 0.4 }, densityGPerMl: 1.04, defaultUnit: "kg" },
  { id: "cottage-cheese", name: "Cottage cheese", category: "Dairy", per100g: { cal: 98, proteinG: 11.1, carbsG: 3.4, fatG: 4.3 }, defaultUnit: "lb" },
  { id: "cheddar", name: "Cheddar cheese", category: "Dairy", per100g: { cal: 403, proteinG: 25, carbsG: 1.3, fatG: 33 }, defaultUnit: "lb" },
  { id: "mozzarella", name: "Mozzarella cheese", category: "Dairy", per100g: { cal: 300, proteinG: 22, carbsG: 2.2, fatG: 22 }, defaultUnit: "lb" },
  { id: "parmesan", name: "Parmesan cheese", category: "Dairy", per100g: { cal: 431, proteinG: 38, carbsG: 4.1, fatG: 29 }, defaultUnit: "lb" },
  { id: "feta", name: "Feta cheese", category: "Dairy", per100g: { cal: 264, proteinG: 14, carbsG: 4.1, fatG: 21 }, defaultUnit: "lb" },
  { id: "butter", name: "Butter", category: "Fat", per100g: { cal: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81 }, densityGPerMl: 0.911, defaultUnit: "lb" },

  // ---- Fats & oils ----
  { id: "olive-oil", name: "Olive oil", category: "Fat", per100g: { cal: 884, proteinG: 0, carbsG: 0, fatG: 100 }, densityGPerMl: 0.913, defaultUnit: "l" },
  { id: "canola-oil", name: "Canola / vegetable oil", category: "Fat", per100g: { cal: 884, proteinG: 0, carbsG: 0, fatG: 100 }, densityGPerMl: 0.92, defaultUnit: "l" },

  // ---- Nuts & seeds ----
  { id: "almonds", name: "Almonds", category: "Nuts & seeds", per100g: { cal: 579, proteinG: 21.2, carbsG: 21.6, fatG: 49.9 }, defaultUnit: "lb" },
  { id: "peanut-butter", name: "Peanut butter", category: "Nuts & seeds", per100g: { cal: 588, proteinG: 25, carbsG: 20, fatG: 50 }, defaultUnit: "lb" },
  { id: "chia", name: "Chia seeds", category: "Nuts & seeds", per100g: { cal: 486, proteinG: 16.5, carbsG: 42.1, fatG: 30.7 }, defaultUnit: "lb" },

  // ---- Condiments & sweeteners ----
  { id: "honey", name: "Honey", category: "Condiment", per100g: { cal: 304, proteinG: 0.3, carbsG: 82.4, fatG: 0 }, densityGPerMl: 1.42, defaultUnit: "l" },
  { id: "maple-syrup", name: "Maple syrup", category: "Condiment", per100g: { cal: 260, proteinG: 0, carbsG: 67, fatG: 0.2 }, densityGPerMl: 1.32, defaultUnit: "l" },
  { id: "soy-sauce", name: "Soy sauce", category: "Condiment", per100g: { cal: 53, proteinG: 8.1, carbsG: 4.9, fatG: 0.6 }, densityGPerMl: 1.2, defaultUnit: "l" },
  { id: "ketchup", name: "Ketchup", category: "Condiment", per100g: { cal: 101, proteinG: 1.7, carbsG: 27, fatG: 0.4 }, densityGPerMl: 1.14, defaultUnit: "l" },
];

const normalize = (s: string) => s.toLowerCase().trim();

/** Search the library by name or alias (case-insensitive substring). */
export function searchNutritionLibrary(query: string, limit = 10): LibraryIngredient[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { item: LibraryIngredient; score: number }[] = [];
  for (const item of NUTRITION_LIBRARY) {
    const name = normalize(item.name);
    const hay = [name, ...(item.aliases ?? []).map(normalize)];
    let score = -1;
    for (const h of hay) {
      if (h === q) { score = 3; break; }
      if (h.startsWith(q)) { score = Math.max(score, 2); }
      else if (h.includes(q)) { score = Math.max(score, 1); }
    }
    if (score >= 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}

/** Grams contained in one `unit` of this ingredient (null if it can't resolve). */
export function gramsPerUnit(item: LibraryIngredient, unit: string): number | null {
  const u = normalize(unit);
  if (u === "ea") return item.gramsPerEach ?? null;
  // 1 unit → grams. Weight units resolve directly; volume needs density.
  const grams = convertQty(1, unit, "g", item.densityGPerMl);
  return grams == null ? null : grams;
}

/**
 * Per-unit macros for this ingredient in the kitchen's chosen unit, derived from
 * the per-100 g values. Returns null when the unit can't convert (e.g. a volume
 * unit with no density, or "ea" with no per-piece weight).
 */
export function perUnitMacros(item: LibraryIngredient, unit: string): Macros | null {
  const grams = gramsPerUnit(item, unit);
  if (grams == null || grams <= 0) return null;
  const f = grams / 100;
  const r = (n: number) => Math.round(n * f * 100) / 100; // 2 dp
  return {
    calories: r(item.per100g.cal),
    proteinG: r(item.per100g.proteinG),
    carbsG: r(item.per100g.carbsG),
    fatG: r(item.per100g.fatG),
  };
}

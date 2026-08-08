import { describe, it, expect } from "vitest";
import { mealMacrosFromRecipe, recipeHasNutrition } from "./nutrition";

// Chicken breast priced/entered per lb: ~748 cal, 140g protein, 0 carbs, 16g fat per lb.
const chicken = { unit: "lb", densityGPerMl: null, calPerUnit: 748, proteinPerUnit: 140, carbsPerUnit: 0, fatPerUnit: 16 };
const quinoa = { unit: "lb", densityGPerMl: null, calPerUnit: 1633, proteinPerUnit: 60, carbsPerUnit: 286, fatPerUnit: 26 };

describe("mealMacrosFromRecipe", () => {
  it("sums, converting recipe units into each ingredient's unit", () => {
    // 8 oz chicken (=0.5 lb) + 0.15 lb quinoa
    const m = mealMacrosFromRecipe([
      { qty: 8, unit: "oz", ingredient: chicken },
      { qty: 0.15, unit: "lb", ingredient: quinoa },
    ]);
    // chicken: 0.5*748=374 cal, 70 P, 0 C, 8 F ; quinoa: 0.15*1633=244.95->..., etc.
    expect(m.calories).toBe(Math.round(0.5 * 748 + 0.15 * 1633));
    expect(m.proteinG).toBe(Math.round(0.5 * 140 + 0.15 * 60));
    expect(m.carbsG).toBe(Math.round(0.15 * 286));
    expect(m.fatG).toBe(Math.round(0.5 * 16 + 0.15 * 26));
  });

  it("empty recipe → all zero", () => {
    expect(mealMacrosFromRecipe([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("ingredient with no nutrition contributes nothing", () => {
    const blank = { unit: "ea", densityGPerMl: null, calPerUnit: 0, proteinPerUnit: 0, carbsPerUnit: 0, fatPerUnit: 0 };
    expect(mealMacrosFromRecipe([{ qty: 3, unit: "ea", ingredient: blank }])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe("recipeHasNutrition", () => {
  it("true when any ingredient carries data", () => {
    expect(recipeHasNutrition([{ qty: 1, unit: "lb", ingredient: chicken }])).toBe(true);
  });
  it("false when none do", () => {
    const blank = { unit: "ea", densityGPerMl: null, calPerUnit: 0, proteinPerUnit: 0, carbsPerUnit: 0, fatPerUnit: 0 };
    expect(recipeHasNutrition([{ qty: 3, unit: "ea", ingredient: blank }])).toBe(false);
  });
});

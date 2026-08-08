// Auto-sum a meal's macros from its recipe. Each ingredient carries nutrition
// PER ITS UNIT (like cost/unit); a recipe amount is converted into that unit,
// then multiplied and summed — exactly parallel to plate-cost math.

import { toPurchaseQty } from "@/lib/units";

export type Macros = { calories: number; proteinG: number; carbsG: number; fatG: number };

export type NutritionLine = {
  qty: number;
  unit: string;
  ingredient: {
    unit: string;
    densityGPerMl?: number | null;
    calPerUnit: number;
    proteinPerUnit: number;
    carbsPerUnit: number;
    fatPerUnit: number;
  };
};

/** Sum a recipe's ingredient nutrition into whole-number meal macros. */
export function mealMacrosFromRecipe(lines: NutritionLine[]): Macros {
  let calories = 0, proteinG = 0, carbsG = 0, fatG = 0;
  for (const l of lines) {
    const q = toPurchaseQty(l.qty, l.unit, l.ingredient.unit, l.ingredient.densityGPerMl).qty;
    calories += q * l.ingredient.calPerUnit;
    proteinG += q * l.ingredient.proteinPerUnit;
    carbsG += q * l.ingredient.carbsPerUnit;
    fatG += q * l.ingredient.fatPerUnit;
  }
  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  };
}

/** Whether any ingredient in the recipe carries nutrition data to sum. */
export function recipeHasNutrition(lines: NutritionLine[]): boolean {
  return lines.some(
    (l) =>
      l.ingredient.calPerUnit > 0 ||
      l.ingredient.proteinPerUnit > 0 ||
      l.ingredient.carbsPerUnit > 0 ||
      l.ingredient.fatPerUnit > 0,
  );
}

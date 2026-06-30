// Shared menu vocabulary — ported from the demo so the form, the storefront,
// and server-side validation all agree on the same option sets.

export const DIET_OPTS = [
  "High Protein",
  "Low Carb",
  "Plant-Based",
  "Keto",
] as const;
export type Diet = (typeof DIET_OPTS)[number];

export const ALLERGENS = ["gluten", "dairy", "nuts", "fish"] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const UNITS = ["oz", "cup", "tbsp", "tsp", "ea", "g", "lb"] as const;
export type Unit = (typeof UNITS)[number];

// Card accent colors assigned to new meals (cycled by menu position).
export const SWATCHES = [
  "#8a5a3c",
  "#5e6b4a",
  "#3f5c5a",
  "#9a5142",
  "#6b5b3e",
  "#4a5240",
  "#7a4a4a",
  "#566073",
];

// Next swatch color for a brand-new meal, cycled by current menu size.
export function swatchForIndex(index: number) {
  return SWATCHES[index % SWATCHES.length];
}

import { describe, it, expect } from "vitest";
import {
  NUTRITION_LIBRARY,
  searchNutritionLibrary,
  gramsPerUnit,
  perUnitMacros,
  sourceOf,
  sourceLabel,
} from "./nutrition-library";

const byId = (id: string) => NUTRITION_LIBRARY.find((i) => i.id === id)!;

describe("searchNutritionLibrary", () => {
  it("matches by name and alias, prefix-ranked", () => {
    const r = searchNutritionLibrary("chicken");
    expect(r[0].id).toBe("chicken-breast");
    expect(r.map((x) => x.id)).toContain("chicken-thigh");
  });
  it("matches aliases", () => {
    expect(searchNutritionLibrary("garbanzo")[0].id).toBe("chickpeas");
    expect(searchNutritionLibrary("capsicum")[0].id).toBe("bell-pepper");
  });
  it("returns nothing for blank/no match", () => {
    expect(searchNutritionLibrary("")).toEqual([]);
    expect(searchNutritionLibrary("zzzznope")).toEqual([]);
  });
});

describe("gramsPerUnit", () => {
  it("weight units resolve directly", () => {
    expect(gramsPerUnit(byId("chicken-breast"), "lb")).toBeCloseTo(453.59237, 3);
    expect(gramsPerUnit(byId("chicken-breast"), "kg")).toBe(1000);
    expect(gramsPerUnit(byId("chicken-breast"), "oz")).toBeCloseTo(28.349523, 3);
  });
  it("volume units need density", () => {
    expect(gramsPerUnit(byId("olive-oil"), "l")).toBeCloseTo(913, 0); // 1000 ml * 0.913
    expect(gramsPerUnit(byId("chicken-breast"), "cup")).toBeNull(); // no density
  });
  it("count units use grams-per-each", () => {
    expect(gramsPerUnit(byId("egg"), "ea")).toBe(50);
    expect(gramsPerUnit(byId("chicken-breast"), "ea")).toBeNull(); // no per-piece weight
  });
});

describe("perUnitMacros", () => {
  it("converts per-100g into per-lb", () => {
    // Chicken breast 120 cal/100g → 120 * 4.5359 ≈ 544.31 per lb
    const m = perUnitMacros(byId("chicken-breast"), "lb")!;
    expect(m.calories).toBeCloseTo(544.31, 1);
    expect(m.proteinG).toBeCloseTo(102.06, 1);
    expect(m.fatG).toBeCloseTo(11.79, 1);
    expect(m.carbsG).toBe(0);
  });
  it("per-egg from per-100g via grams-per-each", () => {
    // 143 cal/100g * 50g/100 = 71.5 cal per egg
    const m = perUnitMacros(byId("egg"), "ea")!;
    expect(m.calories).toBe(71.5);
    expect(m.proteinG).toBe(6.3);
  });
  it("olive oil per litre", () => {
    // 884 cal/100g * 913g/100 = 8070.92 per litre
    const m = perUnitMacros(byId("olive-oil"), "l")!;
    expect(m.calories).toBeCloseTo(8070.92, 0);
    expect(m.fatG).toBeCloseTo(913, 0);
  });
  it("returns null when the unit can't convert", () => {
    expect(perUnitMacros(byId("chicken-breast"), "cup")).toBeNull();
  });
});

describe("data source tags (USDA / CNF)", () => {
  it("sourceOf defaults to 'both' and sourceLabel reads well", () => {
    const egg = byId("egg");
    expect(sourceOf(egg)).toBe("both");
    expect(sourceLabel("both")).toBe("USDA · CNF");
    expect(sourceLabel("cnf")).toBe("CNF");
    expect(sourceLabel("usda")).toBe("USDA");
  });
  it("every entry resolves to a valid source", () => {
    for (const i of NUTRITION_LIBRARY) {
      expect(["usda", "cnf", "both"]).toContain(sourceOf(i));
    }
  });
});

describe("library data integrity", () => {
  it("has a healthy catalog size and unique ids", () => {
    expect(NUTRITION_LIBRARY.length).toBeGreaterThanOrEqual(90);
    const ids = new Set<string>();
    for (const i of NUTRITION_LIBRARY) {
      expect(ids.has(i.id)).toBe(false);
      ids.add(i.id);
    }
  });
  it("has sane macros", () => {
    for (const i of NUTRITION_LIBRARY) {
      expect(i.per100g.cal).toBeGreaterThanOrEqual(0);
      expect(i.per100g.cal).toBeLessThan(1000); // no food exceeds ~900 cal/100g
      for (const k of ["proteinG", "carbsG", "fatG"] as const) {
        expect(i.per100g[k]).toBeGreaterThanOrEqual(0);
        expect(i.per100g[k]).toBeLessThanOrEqual(100);
      }
    }
  });
});

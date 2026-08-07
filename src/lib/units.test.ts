import { describe, it, expect } from "vitest";
import { convertQty, canConvert, dimensionOf, toPurchaseQty, densityFromGramsPerCup } from "./units";

const near = (a: number | null, b: number, tol = 1e-4) => {
  expect(a).not.toBeNull();
  expect(Math.abs((a as number) - b)).toBeLessThan(tol);
};

describe("weight conversions", () => {
  it("8 oz of a per-lb ingredient = 0.5 lb (the recipe screenshot case)", () => {
    near(convertQty(8, "oz", "lb"), 0.5);
  });
  it("1 lb = 16 oz = 453.59 g", () => {
    near(convertQty(1, "lb", "oz"), 16);
    near(convertQty(1, "lb", "g"), 453.59237);
  });
  it("same unit is identity", () => {
    expect(convertQty(3.2, "lb", "lb")).toBe(3.2);
  });
});

describe("volume conversions", () => {
  it("1 cup = 16 tbsp = 236.59 ml", () => {
    near(convertQty(1, "cup", "tbsp"), 16);
    near(convertQty(1, "cup", "ml"), 236.588236);
  });
  it("3 tsp = 1 tbsp", () => {
    near(convertQty(3, "tsp", "tbsp"), 1);
  });
});

describe("cross weight<->volume", () => {
  it("needs a density — null without one", () => {
    expect(convertQty(2, "cup", "lb")).toBeNull();
    expect(canConvert("cup", "lb")).toBe(false);
  });
  it("converts with a density (water ~1 g/ml: 1 cup ≈ 236.6 g ≈ 0.52 lb)", () => {
    near(convertQty(1, "cup", "lb", 1), 236.588236 / 453.59237);
    // and back
    near(convertQty(236.588236 / 453.59237, "lb", "cup", 1), 1);
  });
  it("grams-per-cup helper feeds density (quinoa ~180 g/cup)", () => {
    const d = densityFromGramsPerCup(180);
    // 2 cups quinoa in lb = 360 g = 0.7937 lb
    near(convertQty(2, "cup", "lb", d), 360 / 453.59237);
  });
});

describe("incompatible / unknown", () => {
  it("count never crosses to weight/volume", () => {
    expect(convertQty(1, "ea", "lb")).toBeNull();
    expect(convertQty(1, "lb", "ea")).toBeNull();
  });
  it("unknown units → null", () => {
    expect(convertQty(1, "bushel", "lb")).toBeNull();
  });
});

describe("toPurchaseQty (safe fallback)", () => {
  it("converts when possible", () => {
    const r = toPurchaseQty(8, "oz", "lb");
    expect(r.ok).toBe(true);
    near(r.qty, 0.5);
  });
  it("falls back to raw qty (ok:false) when units don't reconcile", () => {
    const r = toPurchaseQty(2, "cup", "lb");
    expect(r.ok).toBe(false);
    expect(r.qty).toBe(2);
  });
});

describe("dimensionOf", () => {
  it("classifies units", () => {
    expect(dimensionOf("lb")).toBe("weight");
    expect(dimensionOf("CUP")).toBe("volume");
    expect(dimensionOf("ea")).toBe("count");
    expect(dimensionOf("nope")).toBeNull();
  });
});

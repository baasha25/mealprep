import { describe, it, expect } from "vitest";
import { VERTICALS, VERTICAL_META, hiddenNavFor, isVertical, toVertical } from "./verticals";

describe("verticals", () => {
  it("has meta for every vertical and defaults that match the product", () => {
    for (const v of VERTICALS) {
      expect(VERTICAL_META[v].key).toBe(v);
      expect(VERTICAL_META[v].label.length).toBeGreaterThan(2);
      expect(VERTICAL_META[v].firstSteps.length).toBeGreaterThan(2);
    }
    expect(VERTICAL_META.catering.defaults.cateringEnabled).toBe(true);
    expect(VERTICAL_META.boxes.defaults.subscriptionsOnly).toBe(true);
    expect(VERTICAL_META.boxes.defaults.itemNoun).toBe("box");
    expect(VERTICAL_META.meal_prep.defaults).toEqual({ itemNoun: "meal", subscriptionsOnly: false, cateringEnabled: false });
  });

  it("validates and falls back", () => {
    expect(isVertical("catering")).toBe(true);
    expect(isVertical("weddings")).toBe(false);
    expect(toVertical(undefined)).toBe("meal_prep");
    expect(toVertical("boxes")).toBe("boxes");
  });

  it("hides what the vertical does not need, but never a feature that is on", () => {
    const off = { cateringEnabled: false, hasPlans: false, subscriptionsOnly: false };
    expect(hiddenNavFor("meal_prep", off)).toEqual(["/dashboard/catering"]);
    expect(hiddenNavFor("meal_prep", { ...off, cateringEnabled: true })).toEqual([]);
    expect(hiddenNavFor("catering", off).sort()).toEqual(["/dashboard/plans", "/dashboard/subscriptions"]);
    expect(hiddenNavFor("catering", { ...off, hasPlans: true })).toEqual([]);
    expect(hiddenNavFor("prepared_foods", off).sort()).toEqual(["/dashboard/catering", "/dashboard/plans", "/dashboard/subscriptions"]);
    expect(hiddenNavFor("boxes", { ...off, subscriptionsOnly: true }).sort()).toEqual(["/dashboard/catering", "/dashboard/pos"]);
  });
});

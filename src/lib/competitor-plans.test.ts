import { describe, it, expect } from "vitest";
import { parsePlanSize, normalizePlanRows, comparePlans, planMentions } from "./competitor-plans";

describe("parsePlanSize", () => {
  it("reads sizes out of plan labels", () => {
    expect(parsePlanSize("6 meals / week")).toBe(6);
    expect(parsePlanSize("8-Meal Plan")).toBe(8);
    expect(parsePlanSize("Plan of 12")).toBe(12);
    expect(parsePlanSize("16 Entrées")).toBe(16);
    expect(parsePlanSize("Family")).toBeNull();
    expect(parsePlanSize("1 meal")).toBeNull();
    expect(parsePlanSize("60 meals")).toBeNull();
  });
});

describe("normalizePlanRows", () => {
  it("derives per-meal from weekly totals, keeps one row per size (cheapest), drops nonsense", () => {
    const plans = normalizePlanRows(
      [
        { label: "4 meals", perMealPrice: 13.99, deliveryFee: 9.99, startingFrom: false },
        { label: "6 meals / week", weeklyTotal: 74.94, startingFrom: true },
        { mealsPerWeek: 6, perMealPrice: 12.99, startingFrom: false }, // cheaper variant of 6 wins
        { label: "Family", perMealPrice: 10, startingFrom: false }, // no size → dropped
        { mealsPerWeek: 8, perMealPrice: 1.5, startingFrom: false }, // not believable → dropped
        { mealsPerWeek: 10, perMealPrice: 11.49, deliveryFee: 0, startingFrom: false },
      ],
      "https://x.com/plans",
    );
    expect(plans.map((p) => [p.mealsPerWeek, p.perMealCents, p.deliveryFeeCents, p.startingFrom])).toEqual([
      [4, 1399, 999, false],
      [6, 1249, null, true],
      [10, 1149, 0, false],
    ]);
    expect(plans[0].url).toBe("https://x.com/plans");
  });
});

describe("comparePlans", () => {
  const yours = [
    { id: "a", name: "Starter", mealsPerWeek: 5, perMealPriceCents: 1300 },
    { id: "b", name: "Pro", mealsPerWeek: 10, perMealPriceCents: 1150 },
    { id: "c", name: "Mega", mealsPerWeek: 20, perMealPriceCents: 1050 },
  ];
  const comps = [
    { competitorName: "CookUnity", mealsPerWeek: 4, perMealCents: 1399, startingFrom: true, estimated: true, label: "4 meals", url: null },
    { competitorName: "CookUnity", mealsPerWeek: 6, perMealCents: 1249, startingFrom: true, estimated: true, label: "6 meals", url: null },
    { competitorName: "CookUnity", mealsPerWeek: 10, perMealCents: 1149, startingFrom: true, estimated: true, label: "10 meals", url: null },
    { competitorName: "Local", mealsPerWeek: 10, perMealCents: 1200, startingFrom: false, estimated: true, label: null, url: null },
  ];
  it("matches exact sizes, falls back to the nearest size within ±2 and flags it, never beyond", () => {
    const rows = comparePlans(yours, comps);
    expect(rows[0].comps.map((c) => [c.competitorName, c.mealsPerWeek, c.nearestSize])).toEqual([["CookUnity", 6, true]]); // 5 → nearest 6 (tie with 4 broken by closeness then price)
    expect(rows[1].comps.map((c) => [c.competitorName, c.mealsPerWeek, c.nearestSize])).toEqual([["CookUnity", 10, false], ["Local", 10, false]]);
    expect(rows[1].comparison.count).toBe(2);
    expect(rows[1].comparison.medianCents).toBe(Math.round((1149 + 1200) / 2));
    expect(rows[1].position.tone).toBe("inline");
    expect(rows[2].comps).toEqual([]);
    expect(rows[2].position.tone).toBe("none");
  });
  it("planMentions counts pricing language", () => {
    expect(planMentions("From $12.49 per meal on the 6 meals/week plan. Plans start at…")).toBeGreaterThanOrEqual(3);
    expect(planMentions("Chicken bowl $14")).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { buildLookback, nameRows } from "./purchasing-lookback";

describe("buildLookback", () => {
  const needs = [
    { ingredientId: "chk", name: "Chicken thigh", unit: "lb", netQty: 40, trimBps: 1000, costPerUnitCents: 400 }, // gross 44.44
    { ingredientId: "chk", name: "Chicken thigh", unit: "lb", netQty: 10, trimBps: 0, costPerUnitCents: 400 }, // gross 10 → 54.44
    { ingredientId: "rice", name: "Rice", unit: "lb", netQty: 20, trimBps: 0, costPerUnitCents: 150 },
    { ingredientId: "lime", name: "Lime", unit: "each", netQty: 30, trimBps: 0, costPerUnitCents: 40 },
  ];
  const receipts = [
    { ingredientId: "chk", qty: 36, totalCostCents: 14_400 }, // $4.00/lb
    { ingredientId: "chk", qty: 36, totalCostCents: 15_120 }, // $4.20/lb → 72 lb for $295.20, avg $4.10
    { ingredientId: "rice", qty: 20, totalCostCents: 3_000 },
    { ingredientId: "oil", qty: 4, totalCostCents: 6_000 }, // bought, never needed in the window
    { ingredientId: "bad", qty: 0, totalCostCents: 100 }, // ignored
  ];

  it("compares bought against gross need per ingredient and prices surplus at the price paid", () => {
    const lb = buildLookback(90, receipts, needs);
    const chk = lb.rows.find((r) => r.ingredientId === "chk")!;
    expect(chk.boughtQty).toBe(72);
    expect(chk.neededQty).toBeCloseTo(54.44, 1);
    expect(chk.surplusQty).toBeCloseTo(17.56, 1);
    expect(chk.surplusCents).toBe(Math.round(17.555 * 410));
    expect(chk.shareBps).toBe(Math.round((chk.surplusCents / 29_520) * 10000));
    const rice = lb.rows.find((r) => r.ingredientId === "rice")!;
    expect(rice.surplusQty).toBe(0);
    expect(rice.surplusCents).toBe(0);
  });

  it("reports bought-but-unneeded as surplus, never nets shortfalls, and lists unjudged needs", () => {
    const lb = buildLookback(90, receipts, needs);
    const oil = lb.rows.find((r) => r.ingredientId === "oil")!;
    expect(oil.surplusCents).toBe(6_000);
    expect(oil.name).toBe("");
    expect(lb.unjudged).toEqual([{ name: "Lime", neededQty: 30, unit: "each" }]);
    expect(lb.rows[0].ingredientId).toBe("chk"); // biggest surplus first
    expect(lb.receiptCount).toBe(4);
    expect(lb.judgedIngredients).toBe(3);
    expect(lb.boughtCents).toBe(14_400 + 15_120 + 3_000 + 6_000);
    expect(lb.overBoughtCents).toBe(lb.rows.reduce((s, r) => s + r.surplusCents, 0));
    expect(lb.overBoughtBps).toBe(Math.round((lb.overBoughtCents / lb.boughtCents) * 10000));
  });

  it("shortfall shows negative surplus and zero dollars", () => {
    const lb = buildLookback(30, [{ ingredientId: "rice", qty: 5, totalCostCents: 750 }], needs);
    const rice = lb.rows[0];
    expect(rice.surplusQty).toBe(-15);
    expect(rice.surplusCents).toBe(0);
    expect(lb.overBoughtCents).toBe(0);
  });

  it("is empty-safe and names rows from a lookup", () => {
    const empty = buildLookback(90, [], []);
    expect(empty.rows).toEqual([]);
    expect(empty.overBoughtBps).toBe(0);
    const named = nameRows(buildLookback(90, receipts, needs), new Map([["oil", { name: "Canola oil", unit: "L" }]]));
    expect(named.rows.find((r) => r.ingredientId === "oil")!.name).toBe("Canola oil");
  });
});

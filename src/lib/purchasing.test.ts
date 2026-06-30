import { describe, it, expect } from "vitest";
import { grossFromNet, buildShoppingList, type PurchaseLine } from "./purchasing";

describe("grossFromNet", () => {
  it("no trim → gross equals net", () => {
    expect(grossFromNet(10, 0)).toBe(10);
  });

  it("buys more to cover trim waste", () => {
    // 18% trim: to net 1 unit you buy 1/0.82 ≈ 1.2195
    expect(grossFromNet(1, 1800)).toBeCloseTo(1.2195, 4);
  });

  it("clamps absurd trim below 100% (no div-by-zero)", () => {
    expect(Number.isFinite(grossFromNet(1, 10000))).toBe(true);
    expect(Number.isFinite(grossFromNet(1, 99999))).toBe(true);
  });
});

describe("buildShoppingList", () => {
  it("computes gross, waste, and waste dollars for one ingredient", () => {
    const lines: PurchaseLine[] = [
      { ingredientId: "broc", name: "Broccoli", unit: "cup", costPerUnitCents: 40, netQty: 8, trimBps: 2000 },
    ];
    const { rows } = buildShoppingList(lines);
    expect(rows[0].grossQty).toBeCloseTo(10, 6); // 8 / 0.8
    expect(rows[0].wasteQty).toBeCloseTo(2, 6);
    expect(rows[0].buyCostCents).toBe(400); // 10 * 40
    expect(rows[0].netCostCents).toBe(320); // 8 * 40
    expect(rows[0].wasteCostCents).toBe(80);
  });

  it("aggregates the same ingredient across lines with different trim", () => {
    const lines: PurchaseLine[] = [
      { ingredientId: "x", name: "X", unit: "oz", costPerUnitCents: 100, netQty: 10, trimBps: 0 },
      { ingredientId: "x", name: "X", unit: "oz", costPerUnitCents: 100, netQty: 10, trimBps: 5000 }, // 50% trim
    ];
    const { rows } = buildShoppingList(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0].netQty).toBe(20);
    // gross = 10 + (10/0.5)=20  => 30
    expect(rows[0].grossQty).toBeCloseTo(30, 6);
    expect(rows[0].wasteQty).toBeCloseTo(10, 6);
    expect(rows[0].buyCostCents).toBe(3000);
    expect(rows[0].wasteCostCents).toBe(1000);
  });

  it("sorts rows by waste cost desc and totals reconcile", () => {
    const lines: PurchaseLine[] = [
      { ingredientId: "a", name: "Cheap low-trim", unit: "ea", costPerUnitCents: 100, netQty: 5, trimBps: 0 },
      { ingredientId: "b", name: "Pricey high-trim", unit: "lb", costPerUnitCents: 800, netQty: 3, trimBps: 2500 },
    ];
    const list = buildShoppingList(lines);
    expect(list.rows[0].name).toBe("Pricey high-trim");
    expect(list.rows[1].wasteCostCents).toBe(0);
    expect(list.totalBuyCents).toBe(list.totalNetCents + list.totalWasteCents);
    expect(list.totalWasteCents).toBeGreaterThan(0);
    expect(list.wasteBps).toBeGreaterThan(0);
    expect(list.wasteBps).toBeLessThan(10000);
  });

  it("zero-trim ingredient contributes no waste", () => {
    const list = buildShoppingList([
      { ingredientId: "oil", name: "Olive oil", unit: "tbsp", costPerUnitCents: 15, netQty: 6, trimBps: 0 },
    ]);
    expect(list.totalWasteCents).toBe(0);
    expect(list.rows[0].buyCostCents).toBe(90);
  });

  it("empty list is all zeros", () => {
    const list = buildShoppingList([]);
    expect(list.totalBuyCents).toBe(0);
    expect(list.totalWasteCents).toBe(0);
    expect(list.wasteBps).toBe(0);
  });
});

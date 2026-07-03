import { describe, it, expect } from "vitest";
import {
  plateCostCents,
  mealEconomics,
  classifyMenu,
  priceChangeBps,
} from "./profitability";

describe("plateCostCents", () => {
  it("sums gross ingredient cost incl. trim", () => {
    // 6oz chicken @30¢ w/12% trim + 1 tbsp oil @15¢ no trim
    // chicken gross = 6/0.88 = 6.818 → ×30 = 204.5; +15 = 219.5 → 220
    const cost = plateCostCents([
      { qty: 6, trimBps: 1200, costPerUnitCents: 30 },
      { qty: 1, trimBps: 0, costPerUnitCents: 15 },
    ]);
    expect(cost).toBe(220);
  });
  it("no trim, no cost → 0", () => {
    expect(plateCostCents([{ qty: 5, trimBps: 0, costPerUnitCents: 0 }])).toBe(0);
    expect(plateCostCents([])).toBe(0);
  });
});

describe("mealEconomics", () => {
  it("computes margin, margin %, food cost %", () => {
    const e = mealEconomics(1250, 310); // $12.50 price, $3.10 cost
    expect(e.marginCents).toBe(940);
    expect(e.marginBps).toBe(7520); // 75.2%
    expect(e.foodCostBps).toBe(2480); // 24.8%
    expect(e.losing).toBe(false);
  });
  it("flags a money-loser", () => {
    const e = mealEconomics(500, 620);
    expect(e.marginCents).toBe(-120);
    expect(e.losing).toBe(true);
  });
});

describe("classifyMenu", () => {
  it("assigns the four quadrants vs medians", () => {
    const items = [
      { id: "a", marginBps: 8000, units: 100 }, // high margin, high pop → star
      { id: "b", marginBps: 2000, units: 90 }, // low margin, high pop → plowhorse
      { id: "c", marginBps: 7000, units: 5 }, // high margin, low pop → puzzle
      { id: "d", marginBps: 1000, units: 3 }, // low margin, low pop → dog
    ];
    const c = classifyMenu(items);
    const cls = Object.fromEntries(c.map((x) => [x.id, x.menuClass]));
    expect(cls.a).toBe("star");
    expect(cls.b).toBe("plowhorse");
    expect(cls.c).toBe("puzzle");
    expect(cls.d).toBe("dog");
  });
});

describe("priceChangeBps", () => {
  it("computes a cost rise", () => {
    expect(priceChangeBps(100, 114)).toBe(1400); // +14%
    expect(priceChangeBps(200, 180)).toBe(-1000); // −10%
  });
  it("guards zero base", () => {
    expect(priceChangeBps(0, 100)).toBe(0);
  });
});

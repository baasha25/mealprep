import { describe, it, expect } from "vitest";
import {
  costPerUnitFromReceipt,
  stockValueCents,
  toBuyQty,
  stockStatus,
  stockCountVariance,
  wasteVariance,
} from "./inventory";

describe("stockCountVariance", () => {
  it("positive variance = unexplained loss (shelf has less than expected)", () => {
    const v = stockCountVariance(12, 9, 85);
    expect(v.varianceQty).toBe(3);
    expect(v.varianceCents).toBe(255); // 3 × 85¢ lost
  });
  it("negative variance = gain (wasted less than the recipe predicted)", () => {
    const v = stockCountVariance(10, 12, 100);
    expect(v.varianceQty).toBe(-2);
    expect(v.varianceCents).toBe(-200);
  });
  it("zero when the count matches expected", () => {
    expect(stockCountVariance(20, 20, 50)).toEqual({ varianceQty: 0, varianceCents: 0 });
  });
});

describe("costPerUnitFromReceipt", () => {
  it("derives real unit cost from an invoice", () => {
    expect(costPerUnitFromReceipt(4800, 60)).toBe(80); // $48 / 60 oz = 80¢/oz
    expect(costPerUnitFromReceipt(1000, 4)).toBe(250);
  });
  it("guards divide-by-zero", () => {
    expect(costPerUnitFromReceipt(1000, 0)).toBe(0);
  });
});

describe("stockValueCents", () => {
  it("multiplies stock by unit cost", () => {
    expect(stockValueCents(50, 80)).toBe(4000);
    expect(stockValueCents(0, 80)).toBe(0);
  });
});

describe("toBuyQty", () => {
  it("buys only the shortfall after using stock", () => {
    expect(toBuyQty(48.84, 30)).toBeCloseTo(18.84, 5);
    expect(toBuyQty(42, 50)).toBe(0); // fully covered by stock
    expect(toBuyQty(42, -5)).toBe(42); // negative stock treated as 0
  });
});

describe("stockStatus", () => {
  it("flags a shortfall", () => {
    const s = stockStatus(30, 42);
    expect(s.status).toBe("short");
    expect(s.shortfallQty).toBe(12);
  });
  it("is ok when covered without big surplus", () => {
    expect(stockStatus(50, 42).status).toBe("ok");
  });
  it("flags surplus when more than 2x need on hand", () => {
    const s = stockStatus(100, 42);
    expect(s.status).toBe("surplus");
    expect(s.surplusQty).toBe(58);
  });
});

describe("wasteVariance", () => {
  it("surfaces unexplained loss beyond recipe trim", () => {
    // Opened 10, received 50, recipes should have used 42 (incl trim). Expected 18 left.
    // Counted only 12 -> 6 units vanished the recipe didn't predict.
    const v = wasteVariance({
      openingQty: 10,
      receivedQty: 50,
      theoreticalUsedQty: 42,
      countedQty: 12,
      costPerUnitCents: 85,
    });
    expect(v.expectedQty).toBe(18);
    expect(v.unexplainedLossQty).toBe(6);
    expect(v.unexplainedLossCents).toBe(510); // 6 * 85¢
  });
  it("no loss when the count matches expectation", () => {
    const v = wasteVariance({ openingQty: 0, receivedQty: 20, theoreticalUsedQty: 15, countedQty: 5, costPerUnitCents: 100 });
    expect(v.unexplainedLossQty).toBe(0);
    expect(v.unexplainedLossCents).toBe(0);
  });
});

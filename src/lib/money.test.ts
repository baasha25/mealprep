import { describe, it, expect } from "vitest";
import {
  formatCents,
  formatCents0,
  dollarsToCents,
  centsToDollars,
  bpsToPercent,
  percentToBps,
} from "./money";

describe("money formatting", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(99)).toBe("$0.99");
    expect(formatCents(100000)).toBe("$1,000.00");
  });

  it("formats rounded dollar KPIs", () => {
    expect(formatCents0(7075)).toBe("$71");
    expect(formatCents0(1249)).toBe("$12");
    expect(formatCents0(1250)).toBe("$13");
  });
});

describe("dollars <-> cents", () => {
  it("converts dollars to integer cents", () => {
    expect(dollarsToCents(12.5)).toBe(1250);
    expect(dollarsToCents("14.00")).toBe(1400);
    expect(dollarsToCents(4.99)).toBe(499);
    expect(dollarsToCents(0)).toBe(0);
  });

  it("avoids float drift (0.1 + 0.2 style)", () => {
    // 35.35 * 100 is 3534.9999... in float; must round to 3535.
    expect(dollarsToCents(35.35)).toBe(3535);
    expect(dollarsToCents(1.1)).toBe(110);
  });

  it("round-trips through cents", () => {
    for (const d of [11.5, 12.0, 13.0, 15.5, 4.99, 1.5]) {
      expect(centsToDollars(dollarsToCents(d))).toBeCloseTo(d, 5);
    }
  });

  it("rejects non-finite input", () => {
    expect(() => dollarsToCents("abc")).toThrow();
    expect(() => dollarsToCents(Infinity)).toThrow();
  });
});

describe("percent <-> basis points", () => {
  it("converts whole percent to bps", () => {
    expect(percentToBps(8)).toBe(800);
    expect(percentToBps(15)).toBe(1500);
    expect(percentToBps(2)).toBe(200);
    expect(percentToBps(0)).toBe(0);
  });

  it("handles fractional percent", () => {
    expect(percentToBps(8.25)).toBe(825);
    expect(percentToBps("1.5")).toBe(150);
  });

  it("round-trips", () => {
    for (const p of [8, 15, 2, 8.25, 0]) {
      expect(bpsToPercent(percentToBps(p))).toBeCloseTo(p, 5);
    }
  });

  it("rejects non-finite input", () => {
    expect(() => percentToBps("nope")).toThrow();
  });
});

describe("order money math (matches seed)", () => {
  it("computes an order total in pure integer cents", () => {
    // 3x Grilled Chicken ($12.50) + 2x Vegan Buddha Bowl ($11.00)
    const subtotal = 3 * dollarsToCents(12.5) + 2 * dollarsToCents(11.0);
    expect(subtotal).toBe(5950);

    const taxBps = percentToBps(8);
    const tax = Math.round((subtotal * taxBps) / 10000);
    expect(tax).toBe(476);

    const fees = dollarsToCents(4.99) + dollarsToCents(1.5);
    expect(fees).toBe(649);

    expect(subtotal + tax + fees).toBe(7075);
  });
});

import { describe, it, expect } from "vitest";
import { commissionCents, periodMonth } from "./partner-commission";

describe("commissionCents", () => {
  it("20% of a $199 subscription = $39.80", () => {
    expect(commissionCents(19900, 2000)).toBe(3980);
  });
  it("15% of a $79 subscription rounds to the nearest cent", () => {
    expect(commissionCents(7900, 1500)).toBe(1185);
  });
  it("10% of a $349 subscription = $34.90", () => {
    expect(commissionCents(34900, 1000)).toBe(3490);
  });
  it("zero / negative / non-finite base → 0", () => {
    expect(commissionCents(0, 2000)).toBe(0);
    expect(commissionCents(-500, 2000)).toBe(0);
    expect(commissionCents(Number.NaN, 2000)).toBe(0);
  });
  it("clamps the rate to 0–100%", () => {
    expect(commissionCents(10000, -5)).toBe(0);
    expect(commissionCents(10000, 999999)).toBe(10000);
  });
});

describe("periodMonth", () => {
  it("formats YYYY-MM in UTC", () => {
    expect(periodMonth(new Date("2026-09-10T12:00:00Z"))).toBe("2026-09");
    expect(periodMonth(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });
});

import { effectiveRateBps, feeShareCents, platformFeeCents, monthBounds, previousMonth } from "./partner-commission";

describe("step-up and fee share", () => {
  it("uses the base rate until the step-up threshold, then the higher rate", () => {
    expect(effectiveRateBps(2000, 2500, 10, 0)).toBe(2000);
    expect(effectiveRateBps(2000, 2500, 10, 9)).toBe(2000);
    expect(effectiveRateBps(2000, 2500, 10, 10)).toBe(2500);
    expect(effectiveRateBps(2000, 2500, 10, 40)).toBe(2500);
    expect(effectiveRateBps(2000, 1000, 10, 40)).toBe(2000); // never steps down
    expect(effectiveRateBps(2000, 2500, 0, 40)).toBe(2000); // disabled threshold
  });
  it("fee share: $40,000 sales on Growth (1.25%) → fee $500 → partner 20% = $100", () => {
    expect(platformFeeCents(4_000_000, 125)).toBe(50_000);
    expect(feeShareCents(4_000_000, 125, 2000)).toBe(10_000);
    expect(feeShareCents(4_000_000, 125, 2500)).toBe(12_500); // after step-up
  });
  it("month bounds and previous month are UTC calendar months", () => {
    const b = monthBounds("2026-09");
    expect(b.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(previousMonth(new Date("2026-10-02T06:00:00Z"))).toBe("2026-09");
    expect(previousMonth(new Date("2026-01-15T00:00:00Z"))).toBe("2025-12");
  });
});

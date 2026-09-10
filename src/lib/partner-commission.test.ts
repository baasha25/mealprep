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

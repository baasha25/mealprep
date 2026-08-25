import { describe, it, expect } from "vitest";
import {
  rangeDays,
  proratePeriodCents,
  sumMonthlyByCategory,
  primeCostHealth,
  toCostCategory,
  PRIME_COST_TARGET_BPS,
} from "./operating-costs";

describe("rangeDays", () => {
  const now = new Date(2026, 7, 25); // Aug 25, 2026 (day-of-month = 25)
  it("returns fixed spans for today/week", () => {
    expect(rangeDays("today", now)).toBe(1);
    expect(rangeDays("week", now)).toBe(7);
  });
  it("month is day-of-month (month-to-date)", () => {
    expect(rangeDays("month", now)).toBe(25);
  });
  it("all-time spans from the business start date", () => {
    const since = new Date(2026, 7, 5); // 20 days earlier
    expect(rangeDays("all", now, since)).toBeCloseTo(20, 5);
  });
  it("all-time without a start date falls back to an average month", () => {
    expect(rangeDays("all", now, null)).toBeCloseTo(30.4375, 3);
  });
});

describe("proratePeriodCents", () => {
  it("a full average month returns the whole monthly amount", () => {
    expect(proratePeriodCents(400000, 30.4375)).toBe(400000);
  });
  it("half a month returns roughly half", () => {
    expect(proratePeriodCents(400000, 15)).toBe(Math.round((400000 * 15) / 30.4375));
  });
  it("a single day is a small slice", () => {
    expect(proratePeriodCents(300000, 1)).toBe(Math.round(300000 / 30.4375));
  });
  it("stays in integer cents", () => {
    expect(Number.isInteger(proratePeriodCents(123457, 25))).toBe(true);
  });
});

describe("sumMonthlyByCategory", () => {
  it("splits labour and overhead", () => {
    const { laborMonthly, overheadMonthly } = sumMonthlyByCategory([
      { category: "labor", monthlyCents: 90000 },
      { category: "overhead", monthlyCents: 35000 },
      { category: "labor", monthlyCents: 10000 },
    ]);
    expect(laborMonthly).toBe(100000);
    expect(overheadMonthly).toBe(35000);
  });
  it("treats unknown categories as overhead", () => {
    const { laborMonthly, overheadMonthly } = sumMonthlyByCategory([
      { category: "misc", monthlyCents: 5000 },
    ]);
    expect(laborMonthly).toBe(0);
    expect(overheadMonthly).toBe(5000);
  });
});

describe("primeCostHealth", () => {
  it("at or under 55% is healthy", () => {
    expect(primeCostHealth(5400).tone).toBe("good");
    expect(primeCostHealth(PRIME_COST_TARGET_BPS).tone).toBe("good");
  });
  it("55–60% is tight", () => {
    expect(primeCostHealth(5800).tone).toBe("warn");
    expect(primeCostHealth(6000).tone).toBe("warn");
  });
  it("over 60% is too high", () => {
    expect(primeCostHealth(6100).tone).toBe("bad");
  });
});

describe("toCostCategory", () => {
  it("only 'labor' is labour; everything else is overhead", () => {
    expect(toCostCategory("labor")).toBe("labor");
    expect(toCostCategory("overhead")).toBe("overhead");
    expect(toCostCategory("")).toBe("overhead");
    expect(toCostCategory(undefined)).toBe("overhead");
  });
});

import { describe, it, expect } from "vitest";
import { subscriberRisk, marginAlerts, estimateAdminMinutes, winBackDue, abandonedDue, monthRange } from "./insights";

const now = new Date("2026-09-22T12:00:00Z");
const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);

describe("subscriberRisk", () => {
  const base = { status: "active", frequency: "weekly", nextDeliveryDate: d(-3), lastPaidOrderAt: d(5), failedPaymentAt: null, createdAt: d(60) };
  it("healthy weekly sub → no reasons", () => expect(subscriberRisk(base, now)).toEqual([]));
  it("failed payment in last 30d", () => expect(subscriberRisk({ ...base, failedPaymentAt: d(3) }, now)).toContain("payment_failed"));
  it("old failed payment is ignored", () => expect(subscriberRisk({ ...base, failedPaymentAt: d(40) }, now)).toEqual([]));
  it("stuck next delivery date", () => expect(subscriberRisk({ ...base, nextDeliveryDate: d(5) }, now)).toContain("stale_delivery"));
  it("paused", () => expect(subscriberRisk({ ...base, status: "paused" }, now)).toEqual(["paused"]));
  it("inactive weekly (>21d) and biweekly window (>35d)", () => {
    expect(subscriberRisk({ ...base, lastPaidOrderAt: d(25) }, now)).toContain("inactive");
    expect(subscriberRisk({ ...base, frequency: "biweekly", lastPaidOrderAt: d(25) }, now)).toEqual([]);
    expect(subscriberRisk({ ...base, frequency: "biweekly", lastPaidOrderAt: d(40) }, now)).toContain("inactive");
  });
  it("never-paid new sub uses createdAt", () => {
    expect(subscriberRisk({ ...base, lastPaidOrderAt: null, createdAt: d(3) }, now)).toEqual([]);
    expect(subscriberRisk({ ...base, lastPaidOrderAt: null, createdAt: d(30) }, now)).toContain("inactive");
  });
});

describe("marginAlerts", () => {
  it("splits losing vs thin, ignores uncosted", () => {
    const r = marginAlerts([
      { name: "A", marginBps: -500, losing: true, hasRecipe: true },
      { name: "B", marginBps: 4000, losing: false, hasRecipe: true },
      { name: "C", marginBps: 7000, losing: false, hasRecipe: true },
      { name: "D", marginBps: 0, losing: false, hasRecipe: false },
    ]);
    expect(r.losing.map((x) => x.name)).toEqual(["A"]);
    expect(r.thin.map((x) => x.name)).toEqual(["B"]);
  });
});

describe("estimateAdminMinutes", () => {
  it("orders × minutes + meals × 0.5", () => expect(estimateAdminMinutes({ orders: 100, meals: 500, minutesPerOrder: 4 })).toBe(650));
});

describe("winBackDue / abandonedDue", () => {
  it("win-back after N days, respects cooldown", () => {
    expect(winBackDue(d(50), null, now, 45)).toBe(true);
    expect(winBackDue(d(30), null, now, 45)).toBe(false);
    expect(winBackDue(d(50), d(10), now, 45)).toBe(false);
    expect(winBackDue(d(200), d(100), now, 45)).toBe(true);
    expect(winBackDue(null, null, now, 45)).toBe(false);
  });
  it("abandoned within 2–48h and not reminded", () => {
    const h = (hrs: number) => new Date(now.getTime() - hrs * 3_600_000);
    expect(abandonedDue(h(1), null, now)).toBe(false);
    expect(abandonedDue(h(3), null, now)).toBe(true);
    expect(abandonedDue(h(60), null, now)).toBe(false);
    expect(abandonedDue(h(3), h(1), now)).toBe(false);
  });
});

describe("monthRange", () => {
  it("defaults to current month; parses YYYY-MM; no next for current month", () => {
    const cur = monthRange(undefined, now);
    expect(cur.ym).toBe("2026-09"); expect(cur.nextYm).toBeNull(); expect(cur.prevYm).toBe("2026-08");
    const aug = monthRange("2026-08", now);
    expect(aug.start.getMonth()).toBe(7); expect(aug.end.getMonth()).toBe(8); expect(aug.nextYm).toBe("2026-09");
    expect(monthRange("garbage", now).ym).toBe("2026-09");
  });
});

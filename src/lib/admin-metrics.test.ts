import { describe, it, expect } from "vitest";
import {
  billingBadge, setupScore, momentum, daysSince, isQuiet, platformFeeCents, agoLabel,
  parseFilter, filterKitchens, dailyBuckets,
} from "./admin-metrics";

const now = new Date("2026-09-28T12:00:00");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const base = { tier: "growth" as const, createdAt: day(-40), billingSubscriptionId: null, billingComped: false, billingStatus: "none" as const, trialEndsAt: null as Date | null };

describe("billingBadge", () => {
  it("comped wins over everything", () => {
    const b = billingBadge({ ...base, billingComped: true, billingStatus: "active" }, now);
    expect(b.state).toBe("comped"); expect(b.paying).toBe(false);
  });
  it("paying / past due count toward real MRR", () => {
    expect(billingBadge({ ...base, billingStatus: "active" }, now)).toMatchObject({ state: "subscribed", label: "Paying", paying: true });
    expect(billingBadge({ ...base, billingStatus: "past_due" }, now)).toMatchObject({ state: "past_due", tone: "clay", paying: true });
  });
  it("trial shows days left and turns clay inside the last week", () => {
    expect(billingBadge({ ...base, trialEndsAt: day(12) }, now)).toMatchObject({ state: "trialing", label: "Trial · 12d left", tone: "muted" });
    expect(billingBadge({ ...base, trialEndsAt: day(3) }, now)).toMatchObject({ label: "Trial · 3d left", tone: "clay" });
  });
  it("ended trial with no subscription is locked; canceled is canceled", () => {
    expect(billingBadge({ ...base, trialEndsAt: day(-1) }, now).state).toBe("locked");
    expect(billingBadge({ ...base, trialEndsAt: day(-1), billingStatus: "canceled" }, now).state).toBe("canceled");
  });
});

describe("setupScore", () => {
  it("counts the six launch steps", () => {
    const s = setupScore({ meals: 3, plans: 0, stripeConnected: true, hasLogo: false, orders: 0, activeSubs: 0 });
    expect(s.done).toBe(2); expect(s.total).toBe(6); expect(s.complete).toBe(false);
    expect(s.items.filter((i) => !i.done).map((i) => i.key)).toEqual(["plans", "hasLogo", "orders", "activeSubs"]);
  });
  it("complete when everything is done", () => {
    expect(setupScore({ meals: 1, plans: 1, stripeConnected: true, hasLogo: true, orders: 1, activeSubs: 1 }).complete).toBe(true);
  });
});

describe("momentum / activity", () => {
  it("labels direction with a 5% dead-band", () => {
    expect(momentum(14, 10)).toMatchObject({ dir: "up", label: "+40%" });
    expect(momentum(6, 10)).toMatchObject({ dir: "down", label: "-40%" });
    expect(momentum(10, 10)).toMatchObject({ dir: "flat", label: "+0%" });
    expect(momentum(5, 0)).toMatchObject({ dir: "new" });
    expect(momentum(0, 0)).toMatchObject({ dir: "flat", label: "—" });
  });
  it("quiet = 14+ days without an order (or since signup if never ordered)", () => {
    expect(isQuiet(day(-3), day(-100), now)).toBe(false);
    expect(isQuiet(day(-15), day(-100), now)).toBe(true);
    expect(isQuiet(null, day(-5), now)).toBe(false); // brand-new, not quiet yet
    expect(isQuiet(null, day(-20), now)).toBe(true); // signed up 20d ago, never ordered
  });
  it("platform fee rounds to whole cents", () => {
    expect(platformFeeCents(123_456, 150)).toBe(1852); // 1.5%
    expect(platformFeeCents(100_000, 100)).toBe(1000);
  });
  it("ago labels", () => {
    expect(agoLabel(null, now)).toBe("never");
    expect(agoLabel(now, now)).toBe("today");
    expect(agoLabel(day(-1), now)).toBe("yesterday");
    expect(agoLabel(day(-9), now)).toBe("9d ago");
    expect(agoLabel(day(-70), now)).toBe("2 mo ago");
    expect(daysSince(day(-2.5), now)).toBe(2);
  });
});

describe("filters", () => {
  const rows = [
    { name: "Balance Kitchen", slug: "balance-kitchen", ownerEmail: "a@x.com", badge: billingBadge({ ...base, trialEndsAt: day(10) }, now), quiet: false },
    { name: "Greenleaf", slug: "greenleaf", ownerEmail: "b@x.com", badge: billingBadge({ ...base, billingStatus: "active" }, now), quiet: true },
    { name: "Comp Co", slug: null, ownerEmail: "c@x.com", badge: billingBadge({ ...base, billingComped: true }, now), quiet: false },
  ];
  it("parses unknown filters to all", () => {
    expect(parseFilter("paying")).toBe("paying"); expect(parseFilter("nope")).toBe("all"); expect(parseFilter(undefined)).toBe("all");
  });
  it("filters by state, quiet, and search", () => {
    expect(filterKitchens(rows, "trialing", "").map((r) => r.name)).toEqual(["Balance Kitchen"]);
    expect(filterKitchens(rows, "paying", "").map((r) => r.name)).toEqual(["Greenleaf"]);
    expect(filterKitchens(rows, "quiet", "").map((r) => r.name)).toEqual(["Greenleaf"]);
    expect(filterKitchens(rows, "comped", "").map((r) => r.name)).toEqual(["Comp Co"]);
    expect(filterKitchens(rows, "all", "b@x").map((r) => r.name)).toEqual(["Greenleaf"]);
    expect(filterKitchens(rows, "all", "BALANCE").length).toBe(1);
  });
});

describe("dailyBuckets", () => {
  it("buckets the last N days oldest-first and ignores out-of-range", () => {
    const b = dailyBuckets([now, day(-1), day(-1), day(-40)], 7, now);
    expect(b.length).toBe(7);
    expect(b[6].n).toBe(1); expect(b[5].n).toBe(2); expect(b.reduce((s, x) => s + x.n, 0)).toBe(3);
  });
});

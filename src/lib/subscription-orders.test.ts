import { describe, it, expect } from "vitest";
import { dueDeliveryDates, autoPickItems, subscriptionOrderTotals, subscriptionWeeklyCharge, parseNoPick, extrasForDelivery, capItems, beyondPlanCents } from "./subscription-orders";

const TZ = "America/Vancouver";
// Local noon in Vancouver after DST ends (PST, UTC-8) = 20:00 UTC.
const vanNoon = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 20, 0, 0));
const SUN = vanNoon(2026, 11, 8); // Sunday Nov 8 — cut-off 48h before = Fri Nov 6 20:00 UTC
const TUE = vanNoon(2026, 11, 10);

describe("dueDeliveryDates", () => {
  it("is empty before the cut-off and due once it has passed", () => {
    const base = { nextDeliveryDate: SUN, chosenDays: ["Sun"], tz: TZ, existing: [] as Date[] };
    expect(dueDeliveryDates({ ...base, now: new Date(Date.UTC(2026, 10, 6, 19, 0)) })).toEqual([]);
    expect(dueDeliveryDates({ ...base, now: new Date(Date.UTC(2026, 10, 6, 21, 0)) }).map(Number)).toEqual([+SUN]);
  });
  it("skips dates that already have an order and dates older than the grace window", () => {
    const now = new Date(Date.UTC(2026, 10, 7, 12, 0));
    expect(dueDeliveryDates({ now, nextDeliveryDate: SUN, chosenDays: ["Sun"], tz: TZ, existing: [SUN] })).toEqual([]);
    const late = new Date(Date.UTC(2026, 10, 12, 12, 0)); // 4 days after Sunday
    expect(dueDeliveryDates({ now: late, nextDeliveryDate: SUN, chosenDays: ["Sun"], tz: TZ, existing: [] })).toEqual([]);
  });
  it("handles a two-day week: each drop becomes due at its own cut-off", () => {
    const base = { nextDeliveryDate: SUN, chosenDays: ["Sun", "Tue"], tz: TZ, existing: [] as Date[] };
    // Saturday: Sunday's cut-off passed, Tuesday's (Sun 20:00 UTC) not yet.
    expect(dueDeliveryDates({ ...base, now: new Date(Date.UTC(2026, 10, 7, 12, 0)) }).map(Number)).toEqual([+SUN]);
    // Monday: both passed; Sunday already ordered → only Tuesday.
    expect(dueDeliveryDates({ ...base, existing: [SUN], now: new Date(Date.UTC(2026, 10, 9, 12, 0)) }).map(Number)).toEqual([+TUE]);
  });
});

describe("dueDeliveryDates with the kitchen's cut-off rule", () => {
  it("uses the weekly cut-off instead of 48h when given", () => {
    // Fri 8 PM Vancouver = Sat 04:00 UTC; Tuesday delivery locks there, not 48h before.
    const lockAt = (d: Date) => new Date(Date.UTC(2026, 10, 7, 4, 0));
    const base = { nextDeliveryDate: TUE, chosenDays: ["Tue"], tz: TZ, existing: [] as Date[], lockAt };
    expect(dueDeliveryDates({ ...base, now: new Date(Date.UTC(2026, 10, 7, 3, 0)) })).toEqual([]);
    expect(dueDeliveryDates({ ...base, now: new Date(Date.UTC(2026, 10, 7, 5, 0)) }).map(Number)).toEqual([+TUE]);
  });
});

describe("autoPickItems", () => {
  // Deterministic rng: a fixed sequence so shuffles are reproducible.
  const seq = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05];
  const rng = () => { const v = seq[i++ % seq.length]; return v; };
  let i = 0;
  it("draws the plan's count from the subscriber's history, weighted by what they had", () => {
    i = 0;
    const history = [{ mealId: "a", qty: 6 }, { mealId: "b", qty: 3 }, { mealId: "c", qty: 1, optionsKey: "x" }];
    const picks = autoPickItems({ mealsPerWeek: 5, history, fallbackMealIds: [], rng });
    expect(picks.reduce((s, p) => s + p.qty, 0)).toBe(5);
    expect(picks.every((p) => ["a", "b", "c"].includes(p.mealId))).toBe(true);
    // Over many draws, the 6-ticket meal shows up most.
    const tally: Record<string, number> = {};
    for (let k = 0; k < 40; k++) for (const p of autoPickItems({ mealsPerWeek: 5, history, fallbackMealIds: [] })) tally[p.mealId] = (tally[p.mealId] ?? 0) + p.qty;
    expect(tally.a).toBeGreaterThan(tally.b);
    expect(tally.b).toBeGreaterThan(tally.c ?? 0);
  });
  it("reuses a small history to fill the plan and never exceeds it", () => {
    const picks = autoPickItems({ mealsPerWeek: 7, history: [{ mealId: "a", qty: 1 }, { mealId: "b", qty: 1 }], fallbackMealIds: [] });
    expect(picks.reduce((s, p) => s + p.qty, 0)).toBe(7);
    expect(new Set(picks.map((p) => p.mealId))).toEqual(new Set(["a", "b"]));
  });
  it("falls back to the kitchen's go-to meals when there is no history, and to nothing when there's nothing", () => {
    const picks = autoPickItems({ mealsPerWeek: 4, history: [], fallbackMealIds: ["x", "y", "z", "x"] });
    expect(picks.reduce((s, p) => s + p.qty, 0)).toBe(4);
    expect(picks.every((p) => ["x", "y", "z"].includes(p.mealId))).toBe(true);
    expect(autoPickItems({ mealsPerWeek: 4, history: [], fallbackMealIds: [] })).toEqual([]);
    expect(autoPickItems({ mealsPerWeek: 0, history: [{ mealId: "a", qty: 2 }], fallbackMealIds: [] })).toEqual([]);
  });
});

describe("money", () => {
  it("snapshots the plan price per meal plus the zone fee, no tax line", () => {
    expect(subscriptionOrderTotals({ itemCount: 10, perMealPriceCents: 1250, deliveryFeeCents: 700 })).toEqual({ subtotalCents: 12500, taxCents: 0, feesCents: 700, totalCents: 13200 });
    expect(subscriptionOrderTotals({ itemCount: 0, perMealPriceCents: 1250, deliveryFeeCents: 700 }).totalCents).toBe(0);
  });
  it("charges plan × weeks plus fee × weeks per cycle", () => {
    expect(subscriptionWeeklyCharge({ mealsPerWeek: 10, perMealPriceCents: 1250, deliveryFeeCents: 700, intervalCount: 1 })).toEqual({ weeklyPlanCents: 12500, planCents: 12500, feeCents: 700, totalCents: 13200 });
    expect(subscriptionWeeklyCharge({ mealsPerWeek: 10, perMealPriceCents: 1250, deliveryFeeCents: 2000, intervalCount: 2 }).totalCents).toBe(29000);
  });
  it("reads the no-pick setting defensively", () => {
    expect(parseNoPick("chef_choice")).toBe("chef_choice");
    expect(parseNoPick("anything")).toBe("skip");
    expect(parseNoPick(null)).toBe("skip");
  });
});

describe("extras", () => {
  it("bills only the meals beyond the plan, once per cycle", () => {
    expect(extrasForDelivery({ planMeals: 10, pickedBefore: 0, billedBefore: 0, pickedNow: 10 })).toBe(0);
    expect(extrasForDelivery({ planMeals: 10, pickedBefore: 0, billedBefore: 0, pickedNow: 13 })).toBe(3);
    // Two-day week: Sunday took 6 of 10, Tuesday picks 7 → 3 extras on Tuesday.
    expect(extrasForDelivery({ planMeals: 10, pickedBefore: 6, billedBefore: 0, pickedNow: 7 })).toBe(3);
    // Sunday already billed 2 extras (12 picked); Tuesday adds 1 more → 1.
    expect(extrasForDelivery({ planMeals: 10, pickedBefore: 12, billedBefore: 2, pickedNow: 1 })).toBe(1);
    // Under the plan is never negative.
    expect(extrasForDelivery({ planMeals: 10, pickedBefore: 0, billedBefore: 0, pickedNow: 4 })).toBe(0);
  });
  it("capItems trims from the end", () => {
    expect(capItems([{ mealId: "a", qty: 3 }, { mealId: "b", qty: 3 }], 4)).toEqual([{ mealId: "a", qty: 3 }, { mealId: "b", qty: 1 }]);
    expect(capItems([{ mealId: "a", qty: 3 }], 0)).toEqual([]);
  });
});

describe("beyondPlanCents", () => {
  it("adds option upgrades on every meal to the extras", () => {
    expect(beyondPlanCents({ extrasCount: 2, perMealPriceCents: 1050, items: [{ qty: 6, deltaCents: 150 }, { qty: 4, deltaCents: 0 }] })).toEqual({ extrasCents: 2100, upgradesCents: 900, totalCents: 3000 });
    expect(beyondPlanCents({ extrasCount: 0, perMealPriceCents: 1050, items: [{ qty: 3, deltaCents: -200 }] }).totalCents).toBe(0);
  });
});

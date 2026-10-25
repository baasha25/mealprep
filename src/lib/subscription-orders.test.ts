import { describe, it, expect } from "vitest";
import { dueDeliveryDates, chefChoiceItems, subscriptionOrderTotals, subscriptionWeeklyCharge, parseNoPick, extrasForDelivery, capItems } from "./subscription-orders";

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

describe("chefChoiceItems", () => {
  it("repeats the subscriber's last picks when there are any, capped at the plan", () => {
    const last = [{ mealId: "a", qty: 6 }, { mealId: "b", qty: 4, optionsKey: "x" }];
    expect(chefChoiceItems({ mealsPerWeek: 10, lastItems: last, fallbackMealIds: ["z"] })).toEqual(last);
    // Last week they added 3 extras; chef's choice sends the plan only.
    expect(chefChoiceItems({ mealsPerWeek: 7, lastItems: last, fallbackMealIds: [] })).toEqual([{ mealId: "a", qty: 6 }, { mealId: "b", qty: 1, optionsKey: "x" }]);
  });
  it("otherwise spreads the plan across the kitchen's go-to meals", () => {
    expect(chefChoiceItems({ mealsPerWeek: 10, lastItems: [], fallbackMealIds: ["a", "b", "c", "a"] })).toEqual([
      { mealId: "a", qty: 4 },
      { mealId: "b", qty: 3 },
      { mealId: "c", qty: 3 },
    ]);
    expect(chefChoiceItems({ mealsPerWeek: 2, lastItems: [], fallbackMealIds: ["a", "b", "c"] })).toEqual([
      { mealId: "a", qty: 1 },
      { mealId: "b", qty: 1 },
    ]);
    expect(chefChoiceItems({ mealsPerWeek: 10, lastItems: [], fallbackMealIds: [] })).toEqual([]);
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

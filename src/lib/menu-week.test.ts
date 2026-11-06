import { describe, it, expect } from "vitest";
import { weekStartFor, addWeeks, upcomingWeekStarts, weekLabel, mealsForWeek, isCustomWeek, isoWeekKey } from "./menu-week";

const TZ = "America/Toronto";

describe("menu weeks", () => {
  it("keys a week by its Monday at noon UTC, in the kitchen's calendar", () => {
    // Wed Nov 11 2026, 3am Toronto (08:00 UTC)
    const wed = new Date("2026-11-11T08:00:00Z");
    expect(isoWeekKey(weekStartFor(wed, TZ))).toBe("2026-11-09");
    // Sun Nov 15 2026 late evening Toronto is still that week; Monday UTC morning is Sunday night in Toronto → previous week
    expect(isoWeekKey(weekStartFor(new Date("2026-11-16T02:00:00Z"), TZ))).toBe("2026-11-09");
    expect(isoWeekKey(weekStartFor(new Date("2026-11-16T14:00:00Z"), TZ))).toBe("2026-11-16");
    expect(weekStartFor(wed, TZ).getUTCHours()).toBe(12);
  });

  it("lists upcoming weeks and labels them", () => {
    const weeks = upcomingWeekStarts(new Date("2026-11-11T08:00:00Z"), TZ, 3);
    expect(weeks.map(isoWeekKey)).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(weekLabel(weeks[0], TZ)).toBe("Nov 9–15");
    expect(weekLabel(addWeeks(weeks[0], 3), TZ)).toBe("Nov 30–Dec 6");
  });

  it("filters meals only when a week names a custom set", () => {
    const meals = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(mealsForWeek(meals, null)).toEqual(meals);
    expect(mealsForWeek(meals, { mealIds: [] })).toEqual(meals);
    expect(mealsForWeek(meals, { mealIds: ["c", "a", "zzz"] })).toEqual([{ id: "a" }, { id: "c" }]);
    expect(isCustomWeek({ mealIds: ["a"] }, 3)).toBe(true);
    expect(isCustomWeek({ mealIds: ["a", "b", "c"] }, 3)).toBe(false);
    expect(isCustomWeek(null, 3)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  enabledDeliveryDays,
  sanitizePreferredDays,
  describeDeliveryDays,
  dayFullName,
} from "./delivery-days";

describe("enabledDeliveryDays", () => {
  it("returns enabled days in week order", () => {
    expect(
      enabledDeliveryDays({ Mon: true, Tue: false, Wed: true, Thu: false, Fri: true, Sat: false, Sun: false }),
    ).toEqual(["Mon", "Wed", "Fri"]);
  });
  it("handles null/empty", () => {
    expect(enabledDeliveryDays(null)).toEqual([]);
    expect(enabledDeliveryDays({})).toEqual([]);
  });
});

describe("sanitizePreferredDays", () => {
  const enabled = ["Mon", "Thu"];
  it("keeps only enabled days, in week order", () => {
    expect(sanitizePreferredDays(["Thu", "Mon"], enabled)).toEqual(["Mon", "Thu"]);
  });
  it("drops days the kitchen doesn't deliver", () => {
    expect(sanitizePreferredDays(["Mon", "Sun", "Wed"], enabled)).toEqual(["Mon"]);
  });
  it("de-duplicates", () => {
    expect(sanitizePreferredDays(["Mon", "Mon"], enabled)).toEqual(["Mon"]);
  });
  it("empty when nothing valid or nothing chosen", () => {
    expect(sanitizePreferredDays(["Sun"], enabled)).toEqual([]);
    expect(sanitizePreferredDays([], enabled)).toEqual([]);
    expect(sanitizePreferredDays(null, enabled)).toEqual([]);
  });
});

describe("describeDeliveryDays", () => {
  it("formats one and many days", () => {
    expect(describeDeliveryDays(["Mon"])).toBe("Mondays");
    expect(describeDeliveryDays(["Mon", "Thu"])).toBe("Mondays & Thursdays");
    expect(describeDeliveryDays(["Mon", "Wed", "Fri"])).toBe("Mondays, Wednesdays & Fridays");
    expect(describeDeliveryDays([])).toBe("");
  });
  it("dayFullName expands abbreviations", () => {
    expect(dayFullName("Thu")).toBe("Thursday");
  });
});

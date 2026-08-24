import { describe, it, expect } from "vitest";
import { parseCutoff, nextCutoffAt, nextDeliveryAfter, formatDeliveryLabel } from "./cutoff";

describe("parseCutoff", () => {
  it("parses 12-hour with AM/PM", () => {
    expect(parseCutoff("Sat 8:00 PM")).toEqual({ day: 6, hour: 20, minute: 0 });
    expect(parseCutoff("Sun 12:30 AM")).toEqual({ day: 0, hour: 0, minute: 30 });
    expect(parseCutoff("Wed 12:00 PM")).toEqual({ day: 3, hour: 12, minute: 0 });
  });
  it("parses 24-hour and full day names", () => {
    expect(parseCutoff("Mon 17:15")).toEqual({ day: 1, hour: 17, minute: 15 });
    expect(parseCutoff("Friday 9:00 PM")).toEqual({ day: 5, hour: 21, minute: 0 });
  });
  it("returns null on garbage", () => {
    expect(parseCutoff("whenever")).toBeNull();
    expect(parseCutoff("")).toBeNull();
  });
});

describe("nextCutoffAt (America/Toronto, EDT = UTC-4 in August)", () => {
  it("finds next Saturday 8pm from a Monday", () => {
    // Mon Aug 24 2026 12:00 UTC → next Sat Aug 29 20:00 EDT = Aug 30 00:00 UTC
    const r = nextCutoffAt("Sat 8:00 PM", "America/Toronto", new Date("2026-08-24T12:00:00Z"));
    expect(r?.toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });
  it("rolls to next week if today's cutoff already passed", () => {
    // Sat Aug 29 2026 at 22:00 EDT (Aug 30 02:00 UTC) — past 8pm → next Sat Sep 5
    const r = nextCutoffAt("Sat 8:00 PM", "America/Toronto", new Date("2026-08-30T02:00:00Z"));
    expect(r?.toISOString()).toBe("2026-09-06T00:00:00.000Z");
  });
  it("returns a future instant before cutoff on the same day", () => {
    // Sat Aug 29 at 10:00 EDT (14:00 UTC) — before 8pm → same day cutoff
    const r = nextCutoffAt("Sat 8:00 PM", "America/Toronto", new Date("2026-08-29T14:00:00Z"));
    expect(r?.toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });
  it("null on unparseable cutoff", () => {
    expect(nextCutoffAt("nope", "America/Toronto")).toBeNull();
  });
});

describe("nextDeliveryAfter", () => {
  const days = { Sun: true, Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false };
  it("finds the Sunday after a Saturday cutoff", () => {
    const cutoff = new Date("2026-08-30T00:00:00Z"); // Sat Aug 29 8pm EDT
    const d = nextDeliveryAfter(days, cutoff, "America/Toronto");
    expect(formatDeliveryLabel(d!, "America/Toronto")).toBe("Sunday, Aug 30");
  });
  it("returns null when no delivery days are enabled", () => {
    const none = { Sun: false, Mon: false, Tue: false, Wed: false, Thu: false, Fri: false, Sat: false };
    expect(nextDeliveryAfter(none, new Date(), "America/Toronto")).toBeNull();
  });
});

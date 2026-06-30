import { describe, it, expect } from "vitest";
import {
  cycleDays,
  advanceDeliveryDate,
  cutoffAt,
  isBeforeCutoff,
  canModifyNextDelivery,
  canPause,
  canResume,
  CUTOFF_LEAD_HOURS,
} from "./subscriptions";

describe("cycle math", () => {
  it("weekly is 7 days, biweekly is 14", () => {
    expect(cycleDays("weekly")).toBe(7);
    expect(cycleDays("biweekly")).toBe(14);
  });

  it("advances the delivery date by one cycle without mutating input", () => {
    const start = new Date("2026-07-06T12:00:00Z");
    const weekly = advanceDeliveryDate(start, "weekly");
    const biweekly = advanceDeliveryDate(start, "biweekly");
    expect(weekly.toISOString()).toBe("2026-07-13T12:00:00.000Z");
    expect(biweekly.toISOString()).toBe("2026-07-20T12:00:00.000Z");
    // input untouched
    expect(start.toISOString()).toBe("2026-07-06T12:00:00.000Z");
  });
});

describe("cut-off", () => {
  const delivery = new Date("2026-07-10T18:00:00Z");

  it("cutoff is lead-hours before delivery", () => {
    expect(cutoffAt(delivery).toISOString()).toBe("2026-07-08T18:00:00.000Z");
    expect(CUTOFF_LEAD_HOURS).toBe(48);
  });

  it("is before cut-off comfortably ahead", () => {
    expect(isBeforeCutoff(new Date("2026-07-05T00:00:00Z"), delivery)).toBe(true);
  });

  it("is past cut-off inside the lead window", () => {
    expect(isBeforeCutoff(new Date("2026-07-09T00:00:00Z"), delivery)).toBe(false);
  });

  it("is exactly at cut-off → locked (not strictly before)", () => {
    expect(isBeforeCutoff(new Date("2026-07-08T18:00:00Z"), delivery)).toBe(false);
  });

  it("null delivery date is never modifiable", () => {
    expect(isBeforeCutoff(new Date(), null)).toBe(false);
  });
});

describe("state-machine guards", () => {
  const now = new Date("2026-07-05T00:00:00Z");
  const futureDelivery = new Date("2026-07-10T18:00:00Z");
  const soonDelivery = new Date("2026-07-05T06:00:00Z"); // inside cut-off

  it("active + before cutoff can modify next delivery", () => {
    expect(canModifyNextDelivery("active", now, futureDelivery)).toBe(true);
  });

  it("paused subscription cannot modify the next delivery", () => {
    expect(canModifyNextDelivery("paused", now, futureDelivery)).toBe(false);
  });

  it("active but past cutoff cannot modify", () => {
    expect(canModifyNextDelivery("active", now, soonDelivery)).toBe(false);
  });

  it("canceled can neither pause, resume, nor modify", () => {
    expect(canPause("canceled")).toBe(false);
    expect(canResume("canceled")).toBe(false);
    expect(canModifyNextDelivery("canceled", now, futureDelivery)).toBe(false);
  });

  it("pause/resume mirror the active/paused state", () => {
    expect(canPause("active")).toBe(true);
    expect(canPause("paused")).toBe(false);
    expect(canResume("paused")).toBe(true);
    expect(canResume("active")).toBe(false);
  });
});

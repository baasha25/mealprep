import { describe, it, expect } from "vitest";
import { trialStatus, trialEndFrom, TRIAL_DAYS } from "./trial";

const D = 86_400_000;
const now = new Date("2026-08-01T12:00:00Z");

describe("trialStatus", () => {
  it("is active with days left mid-trial", () => {
    const s = trialStatus(new Date(now.getTime() + 12 * D), now);
    expect(s.active).toBe(true);
    expect(s.ended).toBe(false);
    expect(s.daysLeft).toBe(12);
    expect(s.nudge).toBe(false);
  });

  it("nudges in the last 5 days", () => {
    const s = trialStatus(new Date(now.getTime() + 4 * D), now);
    expect(s.active).toBe(true);
    expect(s.nudge).toBe(true);
    expect(s.daysLeft).toBe(4);
  });

  it("rounds partial days up", () => {
    const s = trialStatus(new Date(now.getTime() + 2.4 * D), now);
    expect(s.daysLeft).toBe(3);
  });

  it("is ended once the date passes", () => {
    const s = trialStatus(new Date(now.getTime() - 1 * D), now);
    expect(s.active).toBe(false);
    expect(s.ended).toBe(true);
    expect(s.daysLeft).toBe(0);
    expect(s.nudge).toBe(false);
  });

  it("treats a null trial as no trial (not ended)", () => {
    const s = trialStatus(null, now);
    expect(s.active).toBe(false);
    expect(s.ended).toBe(false);
    expect(s.daysLeft).toBe(0);
    expect(s.endsAt).toBeNull();
  });
});

describe("trialEndFrom", () => {
  it("is TRIAL_DAYS out", () => {
    const end = trialEndFrom(now);
    expect(end.getTime()).toBe(now.getTime() + TRIAL_DAYS * D);
  });
});

import { describe, it, expect } from "vitest";
import { effectiveTier } from "./tiers";

describe("effectiveTier", () => {
  const future = new Date(Date.now() + 5 * 86_400_000);
  const past = new Date(Date.now() - 5 * 86_400_000);

  it("grants Pro-level access during an active trial, whatever the real tier", () => {
    expect(effectiveTier({ tier: "starter", trialEndsAt: future })).toBe("pro");
    expect(effectiveTier({ tier: "growth", trialEndsAt: future })).toBe("pro");
  });

  it("falls back to the real tier once the trial has ended", () => {
    expect(effectiveTier({ tier: "starter", trialEndsAt: past })).toBe("starter");
    expect(effectiveTier({ tier: "growth", trialEndsAt: past })).toBe("growth");
  });

  it("uses the real tier when there is no trial", () => {
    expect(effectiveTier({ tier: "starter", trialEndsAt: null })).toBe("starter");
    expect(effectiveTier({ tier: "pro", trialEndsAt: null })).toBe("pro");
  });
});

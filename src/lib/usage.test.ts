import { describe, it, expect } from "vitest";
import { limitStatusFor } from "./usage";
import { TIERS } from "./tiers";

describe("limitStatusFor — Starter (capped at 150)", () => {
  it("allows orders under the cap", () => {
    const s = limitStatusFor("starter", 149);
    expect(s.atLimit).toBe(false);
    expect(s.remaining).toBe(1);
  });

  it("blocks at exactly the cap (the 151st order)", () => {
    const s = limitStatusFor("starter", 150);
    expect(s.atLimit).toBe(true);
    expect(s.remaining).toBe(0);
  });

  it("stays blocked and never reports negative remaining when over", () => {
    const s = limitStatusFor("starter", 175);
    expect(s.atLimit).toBe(true);
    expect(s.remaining).toBe(0);
  });

  it("warns at 80% (120 of 150) but does not block", () => {
    expect(limitStatusFor("starter", 119).nearLimit).toBe(false);
    const s = limitStatusFor("starter", 120);
    expect(s.nearLimit).toBe(true);
    expect(s.atLimit).toBe(false);
  });
});

describe("limitStatusFor — Growth & Pro (unlimited)", () => {
  for (const tier of ["growth", "pro"] as const) {
    it(`${tier} never blocks or warns, even at high volume`, () => {
      const s = limitStatusFor(tier, 10_000);
      expect(TIERS[tier].orderLimit).toBeNull();
      expect(s.limit).toBeNull();
      expect(s.atLimit).toBe(false);
      expect(s.nearLimit).toBe(false);
      expect(s.remaining).toBeNull();
    });
  }
});

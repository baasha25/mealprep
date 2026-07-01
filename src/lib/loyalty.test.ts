import { describe, it, expect } from "vitest";
import {
  pointsForOrder,
  redeemableValueCents,
  maxRedeemablePoints,
  resolveRedemption,
  referralCodeFrom,
} from "./loyalty";

describe("pointsForOrder", () => {
  it("floors subtotal dollars × rate", () => {
    expect(pointsForOrder(5950, 1)).toBe(59); // $59.50 -> 59
    expect(pointsForOrder(5950, 2)).toBe(119); // floor(59.5 * 2)
    expect(pointsForOrder(10000, 1)).toBe(100);
  });
  it("zero/negative inputs give zero", () => {
    expect(pointsForOrder(0, 1)).toBe(0);
    expect(pointsForOrder(5000, 0)).toBe(0);
  });
});

describe("redeemableValueCents", () => {
  it("points × cents-per-point", () => {
    expect(redeemableValueCents(100, 5)).toBe(500); // 100 pts @ 5¢ = $5
    expect(redeemableValueCents(0, 5)).toBe(0);
  });
});

describe("maxRedeemablePoints", () => {
  it("capped by balance", () => {
    expect(maxRedeemablePoints(30, 10000, 5)).toBe(30); // balance is the limit
  });
  it("capped by order value", () => {
    // order $3 -> 300¢ / 5¢ = 60 affordable, balance 500 -> 60
    expect(maxRedeemablePoints(500, 300, 5)).toBe(60);
  });
  it("zero when nothing to redeem", () => {
    expect(maxRedeemablePoints(0, 1000, 5)).toBe(0);
    expect(maxRedeemablePoints(100, 0, 5)).toBe(0);
  });
});

describe("resolveRedemption", () => {
  it("clamps request to the allowed max and returns cents", () => {
    // want 200, balance 500, order $3 (300¢), 5¢/pt -> max 60
    expect(resolveRedemption(200, 500, 300, 5)).toEqual({ points: 60, cents: 300 });
  });
  it("honors a smaller request", () => {
    expect(resolveRedemption(20, 500, 10000, 5)).toEqual({ points: 20, cents: 100 });
  });
  it("negative/NaN request -> 0", () => {
    expect(resolveRedemption(-5, 500, 10000, 5)).toEqual({ points: 0, cents: 0 });
    expect(resolveRedemption(NaN, 500, 10000, 5)).toEqual({ points: 0, cents: 0 });
  });
});

describe("referralCodeFrom", () => {
  it("uses a letter prefix + deterministic suffix", () => {
    const a = referralCodeFrom("Maria Lopez", 1);
    expect(a).toMatch(/^MAR-[A-Z2-9]{4}$/);
    // deterministic for same seed
    expect(referralCodeFrom("Maria Lopez", 1)).toBe(a);
    // different seed -> different suffix (usually)
    expect(referralCodeFrom("Maria Lopez", 2)).not.toBe(a);
  });
  it("handles names without enough letters", () => {
    expect(referralCodeFrom("", 5)).toMatch(/^X-[A-Z2-9]{4}$/);
  });
});

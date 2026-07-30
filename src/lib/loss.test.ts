import { describe, it, expect } from "vitest";
import {
  ingredientLossCents,
  mealLossCents,
  summarizeLosses,
  daysUntilExpiry,
  LOSS_REASONS,
  LOSS_REASON_META,
} from "./loss";

describe("loss cost math", () => {
  it("values an ingredient loss as qty × cost/unit", () => {
    expect(ingredientLossCents(3, 250)).toBe(750);
    expect(ingredientLossCents(2.5, 100)).toBe(250);
  });

  it("values a meal loss as meals × plate cost", () => {
    expect(mealLossCents(1, 480)).toBe(480);
    expect(mealLossCents(60, 480)).toBe(28800);
  });

  it("Jex scenario: 1 dropped meal at $4.80 plate cost = $4.80 loss", () => {
    expect(mealLossCents(1, 480)).toBe(480);
  });

  it("guards zero / negative / free inputs", () => {
    expect(ingredientLossCents(0, 250)).toBe(0);
    expect(ingredientLossCents(-2, 250)).toBe(0);
    expect(mealLossCents(5, 0)).toBe(0);
    expect(mealLossCents(-1, 480)).toBe(0);
  });

  it("rounds to whole cents", () => {
    expect(ingredientLossCents(1 / 3, 100)).toBe(33);
  });
});

describe("summarizeLosses", () => {
  it("totals and buckets by reason, sorted by cost", () => {
    const { totalCents, byReason } = summarizeLosses([
      { reason: "spoilage", costCents: 500, qty: 2 },
      { reason: "dropped_in_transit", costCents: 480, qty: 1 },
      { reason: "spoilage", costCents: 300, qty: 1 },
      { reason: "pest", costCents: 1000, qty: 4 },
    ]);
    expect(totalCents).toBe(2280);
    expect(byReason[0]).toEqual({ reason: "pest", costCents: 1000, count: 1, qty: 4 });
    expect(byReason.find((r) => r.reason === "spoilage")).toEqual({
      reason: "spoilage",
      costCents: 800,
      count: 2,
      qty: 3,
    });
  });

  it("empty → zero total, no buckets", () => {
    expect(summarizeLosses([])).toEqual({ totalCents: 0, byReason: [] });
  });
});

describe("daysUntilExpiry", () => {
  const received = new Date("2026-07-30T00:00:00Z");
  it("counts down from received + shelf life", () => {
    expect(daysUntilExpiry(received, 5, new Date("2026-07-31T00:00:00Z"))).toBe(4);
    expect(daysUntilExpiry(received, 5, new Date("2026-08-03T00:00:00Z"))).toBe(1);
    expect(daysUntilExpiry(received, 5, new Date("2026-08-04T00:00:00Z"))).toBe(0); // expires today
  });
  it("is negative once expired", () => {
    expect(daysUntilExpiry(received, 5, new Date("2026-08-05T00:00:00Z"))).toBe(-1);
  });
  it("returns null when not tracked", () => {
    expect(daysUntilExpiry(received, null)).toBeNull();
    expect(daysUntilExpiry(received, 0)).toBeNull();
  });
});

describe("reason metadata", () => {
  it("has metadata for every reason", () => {
    for (const r of LOSS_REASONS) {
      expect(LOSS_REASON_META[r]).toBeTruthy();
      expect(LOSS_REASON_META[r].label.length).toBeGreaterThan(0);
    }
  });
});

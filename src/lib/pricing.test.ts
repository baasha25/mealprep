import { describe, it, expect } from "vitest";
import { computeOrder, type PricingSettings } from "./pricing";

const settings: PricingSettings = {
  subDiscountBps: 1500, // 15%
  taxRateBps: 800, // 8%
  deliveryFeeCents: 499,
  processingFeeCents: 150,
  minOrderCents: 3500,
};

describe("computeOrder", () => {
  it("returns a zero/empty order for no lines", () => {
    const t = computeOrder({ lines: [], settings, subscribe: false });
    expect(t.itemCount).toBe(0);
    expect(t.subtotalCents).toBe(0);
    expect(t.totalCents).toBe(0);
    expect(t.feesCents).toBe(0);
    expect(t.belowMinimum).toBe(false);
  });

  it("one-time order: subtotal + tax + fees (matches seed math)", () => {
    // 3x $12.50 + 2x $11.00 = $59.50
    const t = computeOrder({
      lines: [
        { priceCents: 1250, qty: 3 },
        { priceCents: 1100, qty: 2 },
      ],
      settings,
      subscribe: false,
    });
    expect(t.subtotalCents).toBe(5950);
    expect(t.subDiscountCents).toBe(0);
    expect(t.taxCents).toBe(476); // round(5950 * 0.08)
    expect(t.feesCents).toBe(649);
    expect(t.totalCents).toBe(7075);
    expect(t.belowMinimum).toBe(false);
  });

  it("subscription applies the discount before tax", () => {
    const t = computeOrder({
      lines: [{ priceCents: 1000, qty: 10 }], // $100
      settings,
      subscribe: true,
    });
    expect(t.subtotalCents).toBe(10000);
    expect(t.subDiscountCents).toBe(1500); // 15%
    // taxable = 8500 -> tax 680
    expect(t.taxCents).toBe(680);
    expect(t.totalCents).toBe(8500 + 680 + 649);
  });

  it("percent coupon stacks after the subscription discount", () => {
    const t = computeOrder({
      lines: [{ priceCents: 1000, qty: 10 }],
      settings,
      subscribe: true,
      coupon: { type: "percent", value: 10 },
    });
    // afterSub = 8500; coupon 10% = 850
    expect(t.couponCents).toBe(850);
    const taxable = 8500 - 850; // 7650
    expect(t.taxCents).toBe(Math.round(taxable * 0.08)); // 612
    expect(t.totalCents).toBe(taxable + 612 + 649);
  });

  it("flat coupon is capped at the discounted subtotal", () => {
    const t = computeOrder({
      lines: [{ priceCents: 300, qty: 1 }], // $3 subtotal
      settings,
      subscribe: false,
      coupon: { type: "flat", value: 500 }, // $5 off, but only $3 available
    });
    expect(t.couponCents).toBe(300);
    expect(t.taxCents).toBe(0);
    // total is just fees on a $0 taxable order
    expect(t.totalCents).toBe(0 + 0 + 649);
  });

  it("flags below-minimum orders", () => {
    const t = computeOrder({
      lines: [{ priceCents: 1000, qty: 2 }], // $20 < $35 min
      settings,
      subscribe: false,
    });
    expect(t.belowMinimum).toBe(true);
  });

  it("applies loyalty redemption after the coupon, before tax", () => {
    const t = computeOrder({
      lines: [{ priceCents: 1000, qty: 10 }], // $100
      settings,
      subscribe: false,
      redeemCents: 500, // $5 in points
    });
    expect(t.redeemCents).toBe(500);
    const taxable = 10000 - 500; // 9500
    expect(t.taxCents).toBe(Math.round(taxable * 0.08)); // 760
    expect(t.totalCents).toBe(taxable + 760 + 649);
  });

  it("caps redemption so it can't exceed the discounted subtotal", () => {
    const t = computeOrder({
      lines: [{ priceCents: 300, qty: 1 }], // $3
      settings,
      subscribe: false,
      redeemCents: 5000, // way more than the order
    });
    expect(t.redeemCents).toBe(300); // capped to subtotal
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(649); // fees only
  });

  it("never lets discounts drive the order negative", () => {
    const t = computeOrder({
      lines: [{ priceCents: 1000, qty: 1 }],
      settings,
      subscribe: true,
      coupon: { type: "percent", value: 100 }, // 100% off
    });
    expect(t.couponCents).toBeGreaterThan(0);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(649); // fees only
    expect(t.totalCents).toBeGreaterThanOrEqual(0);
  });
});

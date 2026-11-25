import { describe, it, expect } from "vitest";
import {
  etransferOffer, isAwaitingEtransfer, etransferAmountCents, etransferReference, etransferDeadline, etransferExpired,
  clampHoldHours, impliesMoneyIn, isEtransferEmail, HOLD_HOURS_DEFAULT,
} from "./etransfer";

describe("e-transfer checkout rules", () => {
  it("is offered only when switched on with a real address", () => {
    expect(etransferOffer(null)).toBeNull();
    expect(etransferOffer({ etransferEnabled: false, etransferEmail: "pay@kitchen.ca" })).toBeNull();
    expect(etransferOffer({ etransferEnabled: true, etransferEmail: "" })).toBeNull();
    expect(etransferOffer({ etransferEnabled: true, etransferEmail: "not-an-email" })).toBeNull();
    expect(etransferOffer({ etransferEnabled: true, etransferEmail: " pay@kitchen.ca ", etransferNote: "  ", etransferHoldHours: 24 })).toEqual({ email: "pay@kitchen.ca", note: null, holdHours: 24 });
    expect(isEtransferEmail("a@b.co")).toBe(true);
  });

  it("clamps the hold window", () => {
    expect(clampHoldHours(0)).toBe(2);
    expect(clampHoldHours(9999)).toBe(168);
    expect(clampHoldHours(null)).toBe(HOLD_HOURS_DEFAULT);
    expect(clampHoldHours(36.4)).toBe(36);
  });

  it("knows which orders are waiting for money", () => {
    expect(isAwaitingEtransfer({ status: "pending", paymentMethod: "etransfer" })).toBe(true);
    expect(isAwaitingEtransfer({ status: "paid", paymentMethod: "etransfer" })).toBe(false);
    expect(isAwaitingEtransfer({ status: "pending", paymentMethod: null })).toBe(false); // an unfinished card checkout
    expect(isAwaitingEtransfer({ status: "canceled", paymentMethod: "etransfer" })).toBe(false);
  });

  it("asks for the total less any gift card, never below zero", () => {
    expect(etransferAmountCents({ totalCents: 8450, giftRedeemedCents: 0 })).toBe(8450);
    expect(etransferAmountCents({ totalCents: 8450, giftRedeemedCents: 2500 })).toBe(5950);
    expect(etransferAmountCents({ totalCents: 2000, giftRedeemedCents: 2500 })).toBe(0);
    expect(etransferAmountCents({ totalCents: 2000 })).toBe(2000);
  });

  it("builds the reference and the deadline", () => {
    expect(etransferReference("cmabcdefghijk1a2b3c")).toBe("1A2B3C");
    const placed = new Date("2026-11-24T15:00:00Z");
    expect(etransferDeadline(placed, 48).toISOString()).toBe("2026-11-26T15:00:00.000Z");
    expect(etransferExpired(placed, 48, new Date("2026-11-26T14:59:00Z"))).toBe(false);
    expect(etransferExpired(placed, 48, new Date("2026-11-26T15:00:00Z"))).toBe(true);
  });

  it("treats moving an order forward as money received", () => {
    for (const s of ["paid", "in_production", "packed", "out_for_delivery", "fulfilled"]) expect(impliesMoneyIn(s)).toBe(true);
    for (const s of ["pending", "confirmed", "canceled", "refunded"]) expect(impliesMoneyIn(s)).toBe(false);
  });
});

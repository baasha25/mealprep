import { describe, it, expect } from "vitest";
import {
  quoteTotals,
  parseLines,
  minEventDateISO,
  eventDateAllowed,
  addDaysISO,
  eventDateToInstant,
  formatEventDate,
  canQuote,
  canDecline,
  canRecordPayment,
  canApprove,
  requestSummary,
  cateringCode,
} from "./catering";

const TZ = "America/Toronto";
// 2026-10-16 22:30 Toronto = 2026-10-17 02:30 UTC — the date must follow the kitchen's clock, not UTC.
const lateEvening = new Date("2026-10-17T02:30:00.000Z");

describe("quoteTotals", () => {
  it("taxes food after discount, adds the delivery fee untaxed, integer cents", () => {
    const t = quoteTotals([{ qty: 40, unitPriceCents: 1450 }, { qty: 2, unitPriceCents: 3500 }], { deliveryFeeCents: 2500, discountCents: 5000, taxRateBps: 1300 });
    expect(t.mealCount).toBe(42);
    expect(t.subtotalCents).toBe(58000 + 7000);
    expect(t.discountCents).toBe(5000);
    expect(t.taxCents).toBe(Math.round(60000 * 0.13)); // 7800
    expect(t.deliveryFeeCents).toBe(2500);
    expect(t.totalCents).toBe(60000 + 7800 + 2500);
  });
  it("caps the discount at the subtotal and zeroes everything with no lines", () => {
    expect(quoteTotals([{ qty: 1, unitPriceCents: 1000 }], { discountCents: 5000, taxRateBps: 1300 }).totalCents).toBe(0);
    const empty = quoteTotals([], { deliveryFeeCents: 2500, taxRateBps: 1300 });
    expect(empty.totalCents).toBe(0);
    expect(empty.deliveryFeeCents).toBe(0);
  });
});

describe("parseLines", () => {
  it("keeps valid rows, drops junk, coerces numeric strings", () => {
    const lines = parseLines([
      { mealId: "m1", name: "Bowl", qty: "12", unitPriceCents: "1450" },
      { mealId: null, name: "Custom tray", qty: 2, unitPriceCents: 6000 },
      { name: "", qty: 1, unitPriceCents: 1 },
      "nope",
      { mealId: "m2", name: "Zero", qty: 0, unitPriceCents: 100 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].qty).toBe(12);
    expect(lines[1].mealId).toBeNull();
    expect(parseLines(null)).toEqual([]);
  });
});

describe("dates", () => {
  it("counts lead time from the kitchen's own calendar day", () => {
    expect(minEventDateISO(3, TZ, lateEvening)).toBe("2026-10-19"); // Toronto is still Oct 16
    expect(minEventDateISO(3, "UTC", lateEvening)).toBe("2026-10-20");
    expect(minEventDateISO(0, TZ, lateEvening)).toBe("2026-10-16");
  });
  it("allows dates at/after the minimum, rejects earlier, malformed, impossible or >1y out", () => {
    expect(eventDateAllowed("2026-10-19", 3, TZ, lateEvening)).toBe(true);
    expect(eventDateAllowed("2026-10-18", 3, TZ, lateEvening)).toBe(false);
    expect(eventDateAllowed("2026-13-01", 3, TZ, lateEvening)).toBe(false);
    expect(eventDateAllowed("2027-02-30", 3, TZ, lateEvening)).toBe(false);
    expect(eventDateAllowed("2027-12-01", 3, TZ, lateEvening)).toBe(false);
    expect(eventDateAllowed("not a date", 3, TZ, lateEvening)).toBe(false);
  });
  it("addDaysISO crosses month/year ends", () => {
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("stores noon UTC and formats back to the same calendar day in Toronto and Vancouver", () => {
    const d = eventDateToInstant("2026-10-30");
    expect(formatEventDate(d, "America/Toronto")).toBe("Fri, Oct 30, 2026");
    expect(formatEventDate(d, "America/Vancouver")).toBe("Fri, Oct 30, 2026");
  });
});

describe("status gates", () => {
  it("owner can quote until approval, decline until paid, record payment once quoted", () => {
    expect(canQuote("requested")).toBe(true);
    expect(canQuote("approved")).toBe(false);
    expect(canDecline("approved")).toBe(true);
    expect(canDecline("paid")).toBe(false);
    expect(canRecordPayment("requested")).toBe(false);
    expect(canRecordPayment("quoted")).toBe(true);
    expect(canApprove("quoted")).toBe(true);
    expect(canApprove("approved")).toBe(true); // retry payment
    expect(canApprove("paid")).toBe(false);
  });
  it("summaries and codes", () => {
    expect(requestSummary({ headcount: 40, mealCount: 42 })).toBe("42 meals · 40 people");
    expect(requestSummary({ headcount: null, mealCount: 0 })).toBe("details in notes");
    expect(cateringCode("clx9abcdefghij")).toBe("EFGHIJ");
  });
});

import { describe, it, expect } from "vitest";
import {
  depositFor,
  paymentPlan,
  balanceDueAt,
  invoiceDueAt,
  formatInvoiceNumber,
  paidCents,
  outstandingCents,
  daysUntil,
  parseOptions,
  applyOption,
  parseDietary,
  dietarySummary,
  toTerms,
} from "./catering-terms";

const DAY = 86_400_000;

describe("deposits and plans", () => {
  it("rounds the deposit and never exceeds the total", () => {
    expect(depositFor(10_000, 5000)).toBe(5000);
    expect(depositFor(10_001, 5000)).toBe(5001);
    expect(depositFor(10_000, 0)).toBe(0);
    expect(depositFor(10_000, 12_000)).toBe(10_000);
    expect(depositFor(0, 5000)).toBe(0);
  });
  it("picks the plan from terms first, then deposit", () => {
    expect(paymentPlan(10_000, 5000, "net30")).toEqual({ mode: "invoice", dueNowCents: 0, laterCents: 10_000 });
    expect(paymentPlan(10_000, 5000, "on_approval")).toEqual({ mode: "card_deposit", dueNowCents: 5000, laterCents: 5000 });
    expect(paymentPlan(10_000, 0, "on_approval")).toEqual({ mode: "card_full", dueNowCents: 10_000, laterCents: 0 });
    expect(paymentPlan(10_000, 10_000, "on_approval")).toEqual({ mode: "card_full", dueNowCents: 10_000, laterCents: 0 });
  });
  it("dates: balance before the event but not in the past; invoice from terms", () => {
    const now = new Date(2026, 10, 1);
    const event = new Date(2026, 10, 20);
    expect(balanceDueAt(event, 7, now).getTime()).toBe(event.getTime() - 7 * DAY);
    expect(balanceDueAt(event, 30, now).getTime()).toBe(now.getTime());
    expect(invoiceDueAt(now, "net15").getTime()).toBe(now.getTime() + 15 * DAY);
    expect(invoiceDueAt(now, "on_approval").getTime()).toBe(now.getTime());
    expect(daysUntil(new Date(now.getTime() + 3 * DAY), now)).toBe(3);
    expect(daysUntil(new Date(now.getTime() - 2 * DAY), now)).toBe(-2);
  });
  it("invoice numbers and money received", () => {
    expect(formatInvoiceNumber("inv", 1001)).toBe("INV-1001");
    expect(formatInvoiceNumber("", 7)).toBe("INV-7");
    expect(paidCents([{ amountCents: 5000, status: "succeeded" }, { amountCents: 2000, status: "pending" }, { amountCents: 1000, status: "succeeded", refundedAmountCents: 400 }])).toBe(5600);
    expect(outstandingCents(10_000, 5600)).toBe(4400);
    expect(outstandingCents(10_000, 12_000)).toBe(0);
    expect(toTerms("net15")).toBe("net15");
    expect(toTerms("whenever")).toBe("on_approval");
  });
});

describe("options and dietary", () => {
  it("parses up to three options and drops junk", () => {
    const raw = [
      { label: "Boxed lunches", items: [{ mealId: null, name: "Box", qty: 40, unitPriceCents: 1800 }], deliveryFeeCents: 2500, discountCents: 0, ownerNote: null },
      { label: "", items: [] },
      { label: "Platters", items: [{ mealId: "m1", name: "Platter", qty: 4, unitPriceCents: 9500 }] },
      { label: "Four", items: [] },
      { label: "Five", items: [] },
    ];
    const o = parseOptions(raw);
    expect(o.map((x) => x.label)).toEqual(["Boxed lunches", "Platters", "Four"]);
    expect(o[1].deliveryFeeCents).toBe(0);
    expect(applyOption(o[0])).toEqual({ items: o[0].items, deliveryFeeCents: 2500, discountCents: 0, ownerNote: null });
    expect(parseOptions(null)).toEqual([]);
  });
  it("parses dietary counts and summarises them", () => {
    const d = parseDietary({ vegetarian: "12", glutenFree: 3, nutFree: 0, halal: -1, bogus: 9 });
    expect(d).toEqual({ vegetarian: 12, glutenFree: 3 });
    expect(dietarySummary(d)).toBe("12 vegetarian, 3 gluten-free");
    expect(dietarySummary({})).toBe("");
  });
});

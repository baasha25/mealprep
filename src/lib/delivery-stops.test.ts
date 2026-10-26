import { describe, it, expect } from "vitest";
import { stopsFor, splitSummary, dayOptions, effectiveItemDate } from "./delivery-stops";

const MON = new Date("2026-11-02T17:00:00Z");
const WED = new Date("2026-11-04T17:00:00Z");

describe("split deliveries", () => {
  const split = { id: "o1", deliveryDate: MON, items: [{ qty: 2, deliveryDate: MON }, { qty: 3, deliveryDate: WED }, { qty: 1, deliveryDate: null }] };
  const single = { id: "o2", deliveryDate: WED, items: [{ qty: 4, deliveryDate: null }] };
  it("expands a split order into one stop per day, items counted per day (null = order's day)", () => {
    const stops = stopsFor([single, split]);
    expect(stops.map((s) => [s.id, s.items])).toEqual([["o1:2026-11-02", 3], ["o2", 4], ["o1:2026-11-04", 3]]);
  });
  it("summarises a split and stays quiet for a single-day order", () => {
    const fmt = (d: Date) => d.toISOString().slice(5, 10);
    expect(splitSummary(split, fmt)).toBe("11-02 · 3, 11-04 · 3");
    expect(splitSummary(single, fmt)).toBeNull();
  });
  it("builds day chips with totals", () => {
    const days = dayOptions(stopsFor([single, split]));
    expect(days.map((d) => [d.key, d.items, d.stops])).toEqual([["2026-11-02", 3, 1], ["2026-11-04", 7, 2]]);
    expect(effectiveItemDate({ qty: 1 }, { deliveryDate: null })).toBeNull();
  });
});

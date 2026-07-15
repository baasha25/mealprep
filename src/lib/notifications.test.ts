import { describe, it, expect } from "vitest";
import { dueReminders, isoDate } from "./notifications";

const both = { notifyCutoff: true, notifyDeliveryDay: true };

describe("dueReminders", () => {
  it("fires the cut-off reminder when the cut-off is within the next 24h", () => {
    // delivery 60h out → cut-off (delivery − 48h) is 12h away
    const now = new Date("2026-07-14T00:00:00Z");
    const nextDeliveryDate = new Date("2026-07-16T12:00:00Z");
    expect(dueReminders({ now, nextDeliveryDate, ...both })).toEqual(["cutoff"]);
  });

  it("does not fire cut-off once it has already passed", () => {
    // delivery 30h out → cut-off was 18h ago
    const now = new Date("2026-07-14T18:00:00Z");
    const nextDeliveryDate = new Date("2026-07-16T00:00:00Z");
    expect(dueReminders({ now, nextDeliveryDate, ...both })).toEqual([]);
  });

  it("fires the delivery-day email on the delivery date", () => {
    const now = new Date("2026-07-15T08:00:00Z");
    const nextDeliveryDate = new Date("2026-07-15T00:00:00Z");
    expect(dueReminders({ now, nextDeliveryDate, ...both })).toEqual(["delivery_day"]);
  });

  it("fires nothing when the delivery is far off", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    const nextDeliveryDate = new Date("2026-07-25T00:00:00Z");
    expect(dueReminders({ now, nextDeliveryDate, ...both })).toEqual([]);
  });

  it("respects the per-kitchen toggles", () => {
    const cutoffNow = new Date("2026-07-14T00:00:00Z");
    const cutoffDelivery = new Date("2026-07-16T12:00:00Z");
    expect(dueReminders({ now: cutoffNow, nextDeliveryDate: cutoffDelivery, notifyCutoff: false, notifyDeliveryDay: true })).toEqual([]);

    const dayNow = new Date("2026-07-15T08:00:00Z");
    const dayDelivery = new Date("2026-07-15T00:00:00Z");
    expect(dueReminders({ now: dayNow, nextDeliveryDate: dayDelivery, notifyCutoff: true, notifyDeliveryDay: false })).toEqual([]);
  });

  it("isoDate is a stable YYYY-MM-DD key", () => {
    expect(isoDate(new Date("2026-07-15T23:59:59Z"))).toBe("2026-07-15");
  });
});

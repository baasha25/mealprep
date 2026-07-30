import { describe, it, expect } from "vitest";
import {
  countsAsRevenue,
  revenueStatusWhere,
  NON_REVENUE_STATUSES,
  ORDER_STATUSES,
  type OrderStatus,
} from "./order-status";

describe("revenue status", () => {
  it("counts paid/fulfilled/pending/production as revenue", () => {
    for (const s of ["pending", "paid", "in_production", "packed", "out_for_delivery", "fulfilled"] as OrderStatus[]) {
      expect(countsAsRevenue(s)).toBe(true);
    }
  });

  it("excludes canceled and refunded", () => {
    expect(countsAsRevenue("canceled")).toBe(false);
    expect(countsAsRevenue("refunded")).toBe(false);
  });

  it("NON_REVENUE_STATUSES is exactly canceled + refunded", () => {
    expect([...NON_REVENUE_STATUSES].sort()).toEqual(["canceled", "refunded"]);
  });

  it("every order status is classified", () => {
    for (const s of ORDER_STATUSES) {
      expect(typeof countsAsRevenue(s)).toBe("boolean");
    }
  });

  it("where fragment filters the non-revenue statuses", () => {
    expect(revenueStatusWhere).toEqual({ status: { notIn: ["canceled", "refunded"] } });
  });
});

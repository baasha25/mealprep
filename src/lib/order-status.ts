// Order status vocabulary — labels, colors, and the owner-facing workflow order.
// Mirrors the OrderStatus enum in the Prisma schema.

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "paid",
  "in_production",
  "packed",
  "out_for_delivery",
  "fulfilled",
  "canceled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; fg: string; bg: string }
> = {
  pending: { label: "Pending", fg: "#8a6d1f", bg: "#f3e9c9" },
  // Committed but not fully paid: a catering deposit is in, or an invoice was issued on terms.
  confirmed: { label: "Confirmed · balance due", fg: "#3f5c5a", bg: "#d6e4e3" },
  paid: { label: "Paid", fg: "#2f5e3f", bg: "#d9ead9" },
  in_production: { label: "In production", fg: "#3f5c5a", bg: "#d6e4e3" },
  packed: { label: "Packed", fg: "#566073", bg: "#dde1ea" },
  out_for_delivery: { label: "Out for delivery", fg: "#7a4a4a", bg: "#ecdada" },
  fulfilled: { label: "Fulfilled", fg: "#2f5e3f", bg: "#cfe6cf" },
  canceled: { label: "Canceled", fg: "#7a7268", bg: "#e7e3d8" },
  refunded: { label: "Refunded", fg: "#9a5142", bg: "#f0ddd6" },
};

/**
 * Orders the kitchen should cook: money committed (confirmed = deposit in or
 * invoice issued, paid = settled) or already on the line. Shared by Kitchen OS,
 * KDS, purchasing, labels and the production reports.
 */
export const PRODUCING_STATUSES = ["confirmed", "paid", "in_production"] as const;

export const ORDER_TYPE_LABEL: Record<string, string> = {
  subscription: "Subscription",
  one_time: "One-time",
  pos: "POS",
  catering: "Catering",
};

/**
 * Statuses that must NOT count toward revenue / sales / P&L. A canceled or
 * refunded order still exists (for the audit trail and the orders ledger) but
 * its money was never earned — including it overstates every revenue figure.
 */
export const NON_REVENUE_STATUSES: OrderStatus[] = ["canceled", "refunded"];

/** Prisma `where` fragment selecting only orders that count as real revenue. */
export const revenueStatusWhere = { status: { notIn: NON_REVENUE_STATUSES } };

/**
 * Orders that actually ran through PrepFlow. Order history imported from a
 * previous platform (Import → Order history) carries an importBatchId; it is
 * real sales for the kitchen's own P&L and analytics, but never counts toward
 * the plan's order allowance, platform GMV, or partner stats.
 */
export const platformOrdersWhere = { importBatchId: null };

/** Whether an order in this status contributes to revenue / P&L. */
export function countsAsRevenue(status: OrderStatus): boolean {
  return !NON_REVENUE_STATUSES.includes(status);
}

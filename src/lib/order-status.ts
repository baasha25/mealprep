// Order status vocabulary — labels, colors, and the owner-facing workflow order.
// Mirrors the OrderStatus enum in the Prisma schema.

export const ORDER_STATUSES = [
  "pending",
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
  paid: { label: "Paid", fg: "#2f5e3f", bg: "#d9ead9" },
  in_production: { label: "In production", fg: "#3f5c5a", bg: "#d6e4e3" },
  packed: { label: "Packed", fg: "#566073", bg: "#dde1ea" },
  out_for_delivery: { label: "Out for delivery", fg: "#7a4a4a", bg: "#ecdada" },
  fulfilled: { label: "Fulfilled", fg: "#2f5e3f", bg: "#cfe6cf" },
  canceled: { label: "Canceled", fg: "#7a7268", bg: "#e7e3d8" },
  refunded: { label: "Refunded", fg: "#9a5142", bg: "#f0ddd6" },
};

export const ORDER_TYPE_LABEL: Record<string, string> = {
  subscription: "Subscription",
  one_time: "One-time",
  pos: "POS",
};

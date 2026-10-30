// Order-type filter for Analytics and Profitability — pure.
//
// A kitchen that caters wants to see catering margin on its own, and a
// storefront-first kitchen wants its everyday numbers without the odd big
// event skewing them. One `?type=` param, same data underneath.

export type OrderTypeKey = "all" | "storefront" | "catering";

export const ORDER_TYPE_PRESETS: { key: OrderTypeKey; label: string }[] = [
  { key: "all", label: "All orders" },
  { key: "storefront", label: "Storefront" },
  { key: "catering", label: "Catering" },
];

export function toOrderTypeKey(v: unknown): OrderTypeKey {
  return v === "storefront" || v === "catering" ? v : "all";
}

/** Prisma `where` fragment on Order.type ({} for all). */
export function orderTypeWhere(key: OrderTypeKey): { type?: "catering" | { not: "catering" } } {
  if (key === "catering") return { type: "catering" };
  if (key === "storefront") return { type: { not: "catering" } };
  return {};
}

export function orderTypeLabel(key: OrderTypeKey): string {
  return ORDER_TYPE_PRESETS.find((p) => p.key === key)?.label ?? "All orders";
}

// Food-loss accounting — pure integer-cents helpers (CLAUDE.md §9).
// A loss is food paid for that never became paid revenue: raw ingredients that
// spoil / are lost to pests, or finished meals dropped in transit, remade, or
// written off for an order error. These feed the true P&L (revenue − COGS − loss).

export type LossReason =
  | "spoilage"
  | "dropped_in_transit"
  | "order_error"
  | "pest"
  | "remake"
  | "expired"
  | "other";

export type LossKind = "ingredient" | "meal";

export const LOSS_REASONS: LossReason[] = [
  "spoilage",
  "dropped_in_transit",
  "order_error",
  "pest",
  "remake",
  "expired",
  "other",
];

export const LOSS_REASON_META: Record<
  LossReason,
  { label: string; blurb: string; fg: string; bg: string }
> = {
  spoilage: { label: "Spoilage", blurb: "Perished in storage — wilted, molded, sprouted", fg: "#8a6d1f", bg: "#f3e9c9" },
  dropped_in_transit: { label: "Dropped in transit", blurb: "Damaged or lost between kitchen and customer", fg: "#7a4a4a", bg: "#ecdada" },
  order_error: { label: "Order error", blurb: "Wrong or incomplete order, remade or written off", fg: "#566073", bg: "#dde1ea" },
  pest: { label: "Pest / contamination", blurb: "Insect, rodent, or contamination", fg: "#7a4a4a", bg: "#efdcdc" },
  remake: { label: "Remake", blurb: "Cooked twice for one sale — quality reject", fg: "#3f5c5a", bg: "#d6e4e3" },
  expired: { label: "Expired", blurb: "Passed its use-by / shelf life", fg: "#9a5142", bg: "#f0ddd6" },
  other: { label: "Other", blurb: "Anything else", fg: "#7a7268", bg: "#e7e3d8" },
};

/** Food-cost value of a raw-ingredient loss: qty lost × cost per unit. */
export function ingredientLossCents(qtyLost: number, costPerUnitCents: number): number {
  if (qtyLost <= 0 || costPerUnitCents <= 0) return 0;
  return Math.round(qtyLost * costPerUnitCents);
}

/** Food-cost value of a finished-meal loss: meals lost × plate cost. */
export function mealLossCents(mealsLost: number, plateCostCents: number): number {
  if (mealsLost <= 0 || plateCostCents <= 0) return 0;
  return Math.round(mealsLost * plateCostCents);
}

export type LossLike = { reason: LossReason; costCents: number; qty: number };

/** Total loss dollars + a per-reason breakdown, sorted by cost descending. */
export function summarizeLosses(events: LossLike[]): {
  totalCents: number;
  byReason: { reason: LossReason; costCents: number; count: number; qty: number }[];
} {
  const map = new Map<LossReason, { costCents: number; count: number; qty: number }>();
  let totalCents = 0;
  for (const e of events) {
    totalCents += e.costCents;
    const cur = map.get(e.reason) ?? { costCents: 0, count: 0, qty: 0 };
    cur.costCents += e.costCents;
    cur.count += 1;
    cur.qty += e.qty;
    map.set(e.reason, cur);
  }
  const byReason = [...map.entries()]
    .map(([reason, v]) => ({ reason, ...v }))
    .sort((a, b) => b.costCents - a.costCents);
  return { totalCents, byReason };
}

/**
 * Days remaining until an item received on `receivedAt` with `shelfLifeDays`
 * expires, relative to `now`. Negative = already expired. Null if not tracked.
 */
export function daysUntilExpiry(
  receivedAt: Date,
  shelfLifeDays: number | null | undefined,
  now: Date = new Date(),
): number | null {
  if (shelfLifeDays == null || shelfLifeDays <= 0) return null;
  const expiry = receivedAt.getTime() + shelfLifeDays * 86_400_000;
  return Math.floor((expiry - now.getTime()) / 86_400_000);
}

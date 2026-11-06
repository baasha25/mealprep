// Over-bought, looking backwards — pure (tested).
//
// The forward purchasing engine says what this week's orders need after trim.
// This answers the question prospects actually ask: over the last N days, how
// much did I BUY beyond what my orders needed? It compares logged deliveries
// (IngredientReceipt rows: manual "receive stock" and scanned invoices) with
// the gross need of the orders fulfilled in the same window, per ingredient.
//
// Only ingredients with at least one logged delivery in the window are judged;
// without a purchase record there is nothing to compare, and we never invent
// a number. Shortfalls (bought less than needed) are reported but never netted
// against surpluses: stock from before the window explains them, not savings.

import { grossFromNet } from "@/lib/purchasing";

export type LookbackReceipt = { ingredientId: string; qty: number; totalCostCents: number };
export type LookbackNeedLine = { ingredientId: string; name: string; unit: string; netQty: number; trimBps: number; costPerUnitCents: number };

export type LookbackRow = {
  ingredientId: string;
  name: string;
  unit: string;
  boughtQty: number;
  boughtCents: number;
  neededQty: number; // gross need after trim
  neededCents: number; // at the average price actually paid in the window
  surplusQty: number; // bought − needed (negative = shortfall)
  surplusCents: number; // ≥ 0; money spent on quantity no order needed
  shareBps: number; // surplus as a share of what was bought (0 when nothing bought)
};

export type Lookback = {
  days: number;
  rows: LookbackRow[]; // only ingredients with a logged delivery; surplus desc
  overBoughtCents: number;
  boughtCents: number;
  overBoughtBps: number; // over-bought as a share of everything bought
  receiptCount: number;
  judgedIngredients: number;
  /** Ingredients that orders needed but that have no logged delivery in the window. */
  unjudged: { name: string; neededQty: number; unit: string }[];
};

export function buildLookback(days: number, receipts: readonly LookbackReceipt[], needs: readonly LookbackNeedLine[]): Lookback {
  const bought = new Map<string, { qty: number; cents: number; n: number }>();
  for (const r of receipts) {
    if (!(r.qty > 0)) continue;
    const cur = bought.get(r.ingredientId) ?? { qty: 0, cents: 0, n: 0 };
    cur.qty += r.qty;
    cur.cents += Math.max(0, r.totalCostCents);
    cur.n += 1;
    bought.set(r.ingredientId, cur);
  }
  const need = new Map<string, { name: string; unit: string; gross: number; costPerUnitCents: number }>();
  for (const l of needs) {
    const g = grossFromNet(Math.max(0, l.netQty), l.trimBps);
    const cur = need.get(l.ingredientId);
    if (cur) cur.gross += g;
    else need.set(l.ingredientId, { name: l.name, unit: l.unit, gross: g, costPerUnitCents: l.costPerUnitCents });
  }

  const rows: LookbackRow[] = [];
  for (const [id, b] of bought) {
    const n = need.get(id);
    const avgCents = b.qty > 0 ? b.cents / b.qty : 0;
    const neededQty = n?.gross ?? 0;
    const surplusQty = b.qty - neededQty;
    const surplusCents = surplusQty > 0 ? Math.round(surplusQty * avgCents) : 0;
    rows.push({
      ingredientId: id,
      name: n?.name ?? "",
      unit: n?.unit ?? "",
      boughtQty: b.qty,
      boughtCents: b.cents,
      neededQty,
      neededCents: Math.round(neededQty * avgCents),
      surplusQty,
      surplusCents,
      shareBps: b.cents > 0 ? Math.round((surplusCents / b.cents) * 10000) : 0,
    });
  }
  rows.sort((a, b) => b.surplusCents - a.surplusCents);

  const boughtCents = rows.reduce((s, r) => s + r.boughtCents, 0);
  const overBoughtCents = rows.reduce((s, r) => s + r.surplusCents, 0);
  const unjudged = [...need.entries()]
    .filter(([id]) => !bought.has(id))
    .map(([, n]) => ({ name: n.name, neededQty: n.gross, unit: n.unit }))
    .sort((a, b) => b.neededQty - a.neededQty);

  return {
    days,
    rows,
    overBoughtCents,
    boughtCents,
    overBoughtBps: boughtCents > 0 ? Math.round((overBoughtCents / boughtCents) * 10000) : 0,
    receiptCount: receipts.filter((r) => r.qty > 0).length,
    judgedIngredients: rows.length,
    unjudged,
  };
}

/** Fill in names/units for bought-but-never-needed ingredients from a lookup. */
export function nameRows(lb: Lookback, byId: ReadonlyMap<string, { name: string; unit: string }>): Lookback {
  return { ...lb, rows: lb.rows.map((r) => (r.name ? r : { ...r, name: byId.get(r.ingredientId)?.name ?? "Ingredient", unit: byId.get(r.ingredientId)?.unit ?? "" })) };
}

// Trim-aware purchasing engine — PrepFlow's flagship "margin/waste protection".
// Pure integer-cents math so it's testable (CLAUDE.md §9: money math must not break).
//
// Model:
//   - A recipe line needs `netQty` of an ingredient (usable amount in the dish).
//   - `trimBps` is the fraction lost to prep/trim waste (e.g. broccoli stalks).
//   - To END UP with `netQty` usable you must BUY gross = netQty / (1 - trim).
//   - Trim waste (gross - net) is money spent on food you throw away — the
//     "$X over-bought" the owner can attack.
//
// Lines are aggregated per ingredient AT THE LINE LEVEL, so two recipes that
// trim the same ingredient differently are each grossed-up correctly.

export type PurchaseLine = {
  ingredientId: string;
  name: string;
  unit: string;
  costPerUnitCents: number;
  netQty: number; // usable qty this line needs (recipe qty × meals to produce)
  trimBps: number; // trim for this recipe line
};

export type IngredientPurchase = {
  ingredientId: string;
  name: string;
  unit: string;
  costPerUnitCents: number;
  netQty: number;
  grossQty: number; // quantity to actually buy
  wasteQty: number; // gross - net (trimmed away)
  buyCostCents: number; // cost of gross
  netCostCents: number; // cost of the usable portion
  wasteCostCents: number; // money lost to trim ("over-bought")
};

export type ShoppingList = {
  rows: IngredientPurchase[]; // sorted by waste cost desc (biggest savings first)
  totalBuyCents: number;
  totalNetCents: number;
  totalWasteCents: number;
  wasteBps: number; // waste as a share of total purchase cost
};

/** Gross quantity to purchase to net `netQty` usable after trim. */
export function grossFromNet(netQty: number, trimBps: number): number {
  const trim = Math.min(Math.max(trimBps, 0), 9999) / 10000; // clamp <100% to avoid div-by-zero
  return netQty / (1 - trim);
}

/** Aggregate recipe lines into a per-ingredient shopping list + waste summary. */
export function buildShoppingList(lines: PurchaseLine[]): ShoppingList {
  const byIngredient = new Map<
    string,
    {
      name: string;
      unit: string;
      costPerUnitCents: number;
      netQty: number;
      grossQty: number;
    }
  >();

  for (const line of lines) {
    const grossLine = grossFromNet(line.netQty, line.trimBps);
    const cur = byIngredient.get(line.ingredientId);
    if (cur) {
      cur.netQty += line.netQty;
      cur.grossQty += grossLine;
    } else {
      byIngredient.set(line.ingredientId, {
        name: line.name,
        unit: line.unit,
        costPerUnitCents: line.costPerUnitCents,
        netQty: line.netQty,
        grossQty: grossLine,
      });
    }
  }

  const rows: IngredientPurchase[] = [...byIngredient.entries()]
    .map(([ingredientId, a]) => {
      const buyCostCents = Math.round(a.grossQty * a.costPerUnitCents);
      const netCostCents = Math.round(a.netQty * a.costPerUnitCents);
      return {
        ingredientId,
        name: a.name,
        unit: a.unit,
        costPerUnitCents: a.costPerUnitCents,
        netQty: a.netQty,
        grossQty: a.grossQty,
        wasteQty: a.grossQty - a.netQty,
        buyCostCents,
        netCostCents,
        wasteCostCents: buyCostCents - netCostCents,
      };
    })
    .sort((x, y) => y.wasteCostCents - x.wasteCostCents);

  const totalBuyCents = rows.reduce((s, r) => s + r.buyCostCents, 0);
  const totalNetCents = rows.reduce((s, r) => s + r.netCostCents, 0);
  const totalWasteCents = totalBuyCents - totalNetCents;
  const wasteBps =
    totalBuyCents > 0 ? Math.round((totalWasteCents / totalBuyCents) * 10000) : 0;

  return { rows, totalBuyCents, totalNetCents, totalWasteCents, wasteBps };
}

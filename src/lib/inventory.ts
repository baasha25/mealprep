// Inventory & receiving math — pure integer-cents functions (CLAUDE.md §9).
// Receiving records real invoice cost + on-hand stock; the purchasing engine
// then buys only the shortfall, and stock counts reveal actual vs forecast waste.

/** Real cost per unit from a delivery invoice (total paid ÷ quantity received). */
export function costPerUnitFromReceipt(totalCostCents: number, qtyReceived: number): number {
  if (qtyReceived <= 0) return 0;
  return Math.round(totalCostCents / qtyReceived);
}

/** Dollar value of stock on hand. */
export function stockValueCents(stockQty: number, costPerUnitCents: number): number {
  if (stockQty <= 0 || costPerUnitCents <= 0) return 0;
  return Math.round(stockQty * costPerUnitCents);
}

/** Quantity still to purchase after using what's already on hand. */
export function toBuyQty(grossNeededQty: number, stockQty: number): number {
  return Math.max(0, grossNeededQty - Math.max(0, stockQty));
}

export type StockStatus = "short" | "ok" | "surplus";

/** Compare on-hand stock to what production needs. */
export function stockStatus(
  stockQty: number,
  neededQty: number,
): { status: StockStatus; shortfallQty: number; surplusQty: number } {
  const shortfallQty = Math.max(0, neededQty - stockQty);
  const surplusQty = Math.max(0, stockQty - neededQty);
  let status: StockStatus = "ok";
  if (shortfallQty > 0) status = "short";
  else if (neededQty > 0 && surplusQty > neededQty) status = "surplus"; // more than 2x need on hand
  return { status, shortfallQty, surplusQty };
}

/**
 * Waste variance from a stock count. Between counts you received `received` and
 * production theoretically consumed `theoreticalUsed` (net + recipe-trim). The
 * expected remaining is (opening + received − theoreticalUsed); anything missing
 * beyond that is UNEXPLAINED loss — over-trimming, spoilage, or theft the recipe
 * trim % didn't predict.
 */
export function wasteVariance(opts: {
  openingQty: number;
  receivedQty: number;
  theoreticalUsedQty: number;
  countedQty: number;
  costPerUnitCents: number;
}): { expectedQty: number; unexplainedLossQty: number; unexplainedLossCents: number } {
  const expectedQty = opts.openingQty + opts.receivedQty - opts.theoreticalUsedQty;
  const unexplainedLossQty = Math.max(0, expectedQty - opts.countedQty);
  return {
    expectedQty,
    unexplainedLossQty,
    unexplainedLossCents: Math.round(unexplainedLossQty * opts.costPerUnitCents),
  };
}

// Server-side data for "needs attention" signals — shared by the Dashboard
// panel, Profitability, and Subscriptions so every page reads the same rules.

import { db } from "@/lib/db";
import { costPerUnitFromReceipt } from "@/lib/inventory";
import { priceChangeBps, plateCostFromRecipe, mealEconomics } from "@/lib/profitability";
import { defaultOptionIds } from "@/lib/meal-options";
import { revenueStatusWhere } from "@/lib/order-status";
import { subscriberRisk, marginAlerts, type RiskReason } from "@/lib/insights";

export type PriceRise = { name: string; changeBps: number; affected: string[] };

/** Ingredients whose latest receipt cost/unit rose ≥ minBps vs the previous receipt. */
export async function ingredientPriceRises(businessId: string, minBps = 300): Promise<PriceRise[]> {
  const priced = await db.ingredient.findMany({
    where: { businessId },
    select: {
      name: true,
      receipts: { orderBy: { receivedAt: "desc" }, take: 2, select: { qtyReceived: true, totalCostCents: true } },
      mealIngredients: { select: { meal: { select: { name: true, active: true } } } },
    },
  });
  return priced
    .map((ing) => {
      if (ing.receipts.length < 2) return null;
      const [newer, older] = ing.receipts;
      const changeBps = priceChangeBps(
        costPerUnitFromReceipt(older.totalCostCents, older.qtyReceived),
        costPerUnitFromReceipt(newer.totalCostCents, newer.qtyReceived),
      );
      if (changeBps < minBps) return null;
      const affected = [...new Set(ing.mealIngredients.filter((mi) => mi.meal.active).map((mi) => mi.meal.name))];
      return { name: ing.name, changeBps, affected };
    })
    .filter((x): x is PriceRise => x !== null)
    .sort((a, b) => b.changeBps - a.changeBps);
}

export type MarginRow = { id: string; name: string; priceCents: number; costCents: number; marginBps: number; losing: boolean; hasRecipe: boolean };

/** Every active meal's plate cost (default configuration) + margin, and the alert split. */
export async function menuMarginSnapshot(businessId: string, thresholdBps = 5000): Promise<{ rows: MarginRow[]; losing: MarginRow[]; thin: MarginRow[] }> {
  const meals = await db.meal.findMany({
    where: { businessId, active: true },
    select: {
      id: true, name: true, priceCents: true,
      ingredients: { select: { qty: true, unit: true, trimBps: true, ingredient: { select: { unit: true, costPerUnitCents: true, densityGPerMl: true } } } },
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, name: true, minSelect: true, maxSelect: true,
          options: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, priceDeltaCents: true, isDefault: true, ingredients: { select: { qty: true, unit: true, trimBps: true, ingredient: { select: { unit: true, costPerUnitCents: true, densityGPerMl: true } } } } } },
        },
      },
    },
  });
  const rows: MarginRow[] = meals.map((m) => {
    const defaults = new Set(defaultOptionIds(m.optionGroups));
    const optionLines = m.optionGroups.flatMap((g) => g.options.filter((o) => defaults.has(o.id)).flatMap((o) => o.ingredients));
    const costCents = plateCostFromRecipe([...m.ingredients, ...optionLines]);
    const econ = mealEconomics(m.priceCents, costCents);
    return { id: m.id, name: m.name, priceCents: m.priceCents, costCents, marginBps: econ.marginBps, losing: econ.losing, hasRecipe: m.ingredients.length > 0 };
  });
  const { losing, thin } = marginAlerts(rows, thresholdBps);
  return { rows, losing, thin };
}

export type AtRiskSub = {
  id: string;
  customerName: string;
  email: string;
  planName: string;
  status: string;
  frequency: string;
  nextDeliveryDate: Date | null;
  reasons: RiskReason[];
};

/** Active/paused subscribers showing churn signals (see insights.subscriberRisk). */
export async function atRiskSubscribers(businessId: string, now: Date = new Date()): Promise<AtRiskSub[]> {
  const subs = await db.subscription.findMany({
    where: { businessId, status: { in: ["active", "paused"] } },
    include: { customer: { select: { id: true, name: true, email: true } }, plan: { select: { name: true } } },
  });
  if (subs.length === 0) return [];
  const custIds = [...new Set(subs.map((s) => s.customerId))];

  const [lastPaid, failed] = await Promise.all([
    db.order.groupBy({
      by: ["customerId"],
      where: { businessId, customerId: { in: custIds }, ...revenueStatusWhere },
      _max: { createdAt: true },
    }),
    db.payment.findMany({
      where: { status: "failed", createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) }, order: { businessId, customerId: { in: custIds } } },
      select: { createdAt: true, order: { select: { customerId: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const lastPaidBy = new Map(lastPaid.map((r) => [r.customerId as string, r._max.createdAt]));
  const failedBy = new Map<string, Date>();
  for (const f of failed) {
    const cid = f.order.customerId;
    if (cid && !failedBy.has(cid)) failedBy.set(cid, f.createdAt);
  }

  const out: AtRiskSub[] = [];
  for (const s of subs) {
    const reasons = subscriberRisk(
      {
        status: s.status,
        frequency: s.frequency,
        nextDeliveryDate: s.nextDeliveryDate,
        lastPaidOrderAt: lastPaidBy.get(s.customerId) ?? null,
        failedPaymentAt: failedBy.get(s.customerId) ?? null,
        createdAt: s.createdAt,
      },
      now,
    );
    if (reasons.length === 0) continue;
    out.push({
      id: s.id,
      customerName: s.customer?.name ?? "Subscriber",
      email: s.customer?.email ?? "",
      planName: s.plan.name,
      status: s.status,
      frequency: s.frequency,
      nextDeliveryDate: s.nextDeliveryDate,
      reasons,
    });
  }
  // Most urgent first: failed payment > stale delivery > inactive > paused.
  const rank: Record<RiskReason, number> = { payment_failed: 0, stale_delivery: 1, inactive: 2, paused: 3 };
  return out.sort((a, b) => Math.min(...a.reasons.map((r) => rank[r])) - Math.min(...b.reasons.map((r) => rank[r])));
}

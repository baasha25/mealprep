// Over-bought lookback — DB side. Pure math in src/lib/purchasing-lookback.ts.

import { db } from "@/lib/db";
import { revenueStatusWhere } from "@/lib/order-status";
import { picksFromSnapshot } from "@/lib/meal-options";
import { toPurchaseQty } from "@/lib/units";
import { buildLookback, nameRows, type Lookback, type LookbackNeedLine, type LookbackReceipt } from "@/lib/purchasing-lookback";

export const LOOKBACK_DAYS = [30, 90, 180] as const;
export type LookbackDays = (typeof LOOKBACK_DAYS)[number];

export function toLookbackDays(v: unknown): LookbackDays {
  const n = Number(v);
  return (LOOKBACK_DAYS as readonly number[]).includes(n) ? (n as LookbackDays) : 90;
}

/**
 * Deliveries logged in the window vs. the gross need of orders sold in it.
 * Orders count by the date they were placed (imported history included), so a
 * kitchen that just loaded six months of orders and its invoices sees a real
 * number on day one.
 */
export async function loadLookback(businessId: string, days: LookbackDays, now: Date = new Date()): Promise<Lookback> {
  const since = new Date(now.getTime() - days * 86_400_000);

  const [receiptRows, orderItems] = await Promise.all([
    db.ingredientReceipt.findMany({
      where: { businessId, receivedAt: { gte: since } },
      select: { ingredientId: true, qtyReceived: true, totalCostCents: true },
    }),
    db.orderItem.findMany({
      where: { order: { businessId, createdAt: { gte: since }, ...revenueStatusWhere }, mealId: { not: null } },
      select: {
        qty: true,
        optionsSnapshot: true,
        meal: {
          select: {
            ingredients: {
              select: { qty: true, unit: true, trimBps: true, ingredient: { select: { id: true, name: true, unit: true, costPerUnitCents: true, densityGPerMl: true } } },
            },
          },
        },
      },
    }),
  ]);

  const receipts: LookbackReceipt[] = receiptRows.map((r) => ({ ingredientId: r.ingredientId, qty: r.qtyReceived, totalCostCents: r.totalCostCents }));

  const needs: LookbackNeedLine[] = [];
  for (const oi of orderItems) {
    if (!oi.meal) continue;
    for (const mi of oi.meal.ingredients) {
      const net = toPurchaseQty(mi.qty * oi.qty, mi.unit, mi.ingredient.unit, mi.ingredient.densityGPerMl).qty;
      needs.push({ ingredientId: mi.ingredient.id, name: mi.ingredient.name, unit: mi.ingredient.unit, netQty: net, trimBps: mi.trimBps, costPerUnitCents: mi.ingredient.costPerUnitCents });
    }
  }
  // Build-your-own options bought per unit ordered, same as the forward list.
  const optQty = new Map<string, number>();
  for (const oi of orderItems) for (const p of picksFromSnapshot(oi.optionsSnapshot)) optQty.set(p.optionId, (optQty.get(p.optionId) ?? 0) + oi.qty);
  if (optQty.size) {
    const opts = await db.mealOption.findMany({
      where: { id: { in: [...optQty.keys()] } },
      select: { id: true, ingredients: { select: { qty: true, unit: true, trimBps: true, ingredient: { select: { id: true, name: true, unit: true, costPerUnitCents: true, densityGPerMl: true } } } } },
    });
    for (const o of opts) {
      const n = optQty.get(o.id) ?? 0;
      for (const oi of o.ingredients) {
        const net = toPurchaseQty(oi.qty * n, oi.unit, oi.ingredient.unit, oi.ingredient.densityGPerMl).qty;
        needs.push({ ingredientId: oi.ingredient.id, name: oi.ingredient.name, unit: oi.ingredient.unit, netQty: net, trimBps: oi.trimBps, costPerUnitCents: oi.ingredient.costPerUnitCents });
      }
    }
  }

  const lb = buildLookback(days, receipts, needs);
  // Ingredients bought but never needed by an order: name them from the catalogue.
  const unnamed = lb.rows.filter((r) => !r.name).map((r) => r.ingredientId);
  if (unnamed.length === 0) return lb;
  const named = await db.ingredient.findMany({ where: { id: { in: unnamed }, businessId }, select: { id: true, name: true, unit: true } });
  return nameRows(lb, new Map(named.map((i) => [i.id, { name: i.name, unit: i.unit }])));
}

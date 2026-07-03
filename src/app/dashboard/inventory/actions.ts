"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { dollarsToCents } from "@/lib/money";
import { costPerUnitFromReceipt, stockCountVariance } from "@/lib/inventory";
import { buildShoppingList, type PurchaseLine } from "@/lib/purchasing";

export type ReceiveState = { ok: boolean; message?: string };

const ReceiveInput = z.object({
  ingredientId: z.string().min(1),
  qty: z.coerce.number().positive("Enter a quantity"),
  totalCost: z.coerce.number().min(0).max(1_000_000),
});

/** Log a delivery: add to stock and set the real cost/unit from the invoice. */
export async function receiveStock(_prev: ReceiveState, formData: FormData): Promise<ReceiveState> {
  const { business } = await requireBusiness();
  const parsed = ReceiveInput.safeParse({
    ingredientId: formData.get("ingredientId"),
    qty: formData.get("qty"),
    totalCost: formData.get("totalCost"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid delivery." };
  const d = parsed.data;

  const ingredient = await db.ingredient.findFirst({
    where: { id: d.ingredientId, businessId: business.id },
    select: { id: true, unit: true },
  });
  if (!ingredient) return { ok: false, message: "Ingredient not found." };

  const totalCostCents = dollarsToCents(d.totalCost);

  await db.$transaction([
    db.ingredientReceipt.create({
      data: {
        businessId: business.id,
        ingredientId: ingredient.id,
        qtyReceived: d.qty,
        unit: ingredient.unit,
        totalCostCents,
        note: "Delivery",
      },
    }),
    db.ingredient.update({
      where: { id: ingredient.id },
      data: {
        stockQty: { increment: d.qty },
        // Real cost/unit from this invoice keeps the waste engine honest.
        costPerUnitCents: costPerUnitFromReceipt(totalCostCents, d.qty),
      },
    }),
  ]);

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/purchasing");
  return { ok: true, message: "Delivery received." };
}

const CountInput = z.object({
  ingredientId: z.string().min(1),
  counted: z.coerce.number().min(0).max(1_000_000),
});

/**
 * Record a physical stock count. Compares the count to what the system expected
 * on hand, logs the variance (unexplained loss beyond recipe trim), then
 * reconciles stock to the counted amount.
 */
export async function recordStockCount(_prev: ReceiveState, formData: FormData): Promise<ReceiveState> {
  const { business } = await requireBusiness();
  const parsed = CountInput.safeParse({
    ingredientId: formData.get("ingredientId"),
    counted: formData.get("counted"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid count." };

  const ingredient = await db.ingredient.findFirst({
    where: { id: parsed.data.ingredientId, businessId: business.id },
    select: { id: true, stockQty: true, costPerUnitCents: true },
  });
  if (!ingredient) return { ok: false, message: "Ingredient not found." };

  const { varianceQty, varianceCents } = stockCountVariance(
    ingredient.stockQty,
    parsed.data.counted,
    ingredient.costPerUnitCents,
  );

  await db.$transaction([
    db.stockCount.create({
      data: {
        businessId: business.id,
        ingredientId: ingredient.id,
        expectedQty: ingredient.stockQty,
        countedQty: parsed.data.counted,
        varianceQty,
        varianceCents,
      },
    }),
    // Reconcile the system's belief to the physical count.
    db.ingredient.update({ where: { id: ingredient.id }, data: { stockQty: parsed.data.counted } }),
  ]);

  revalidatePath("/dashboard/inventory");
  const lost = varianceCents > 0;
  return {
    ok: true,
    message: lost
      ? `Counted — ${(varianceQty).toFixed(2)} unexplained loss recorded.`
      : "Counted — stock reconciled.",
  };
}

/**
 * "Mark this run cooked" — deduct the production queue's gross requirement from
 * stock, so on-hand reflects what's been consumed.
 */
export async function consumeProductionQueue() {
  const { business } = await requireBusiness();

  const items = await db.orderItem.findMany({
    where: {
      order: { businessId: business.id, status: { in: ["paid", "in_production"] } },
      mealId: { not: null },
    },
    select: {
      qty: true,
      meal: {
        select: {
          ingredients: {
            select: { qty: true, unit: true, trimBps: true, ingredient: { select: { id: true, name: true, costPerUnitCents: true } } },
          },
        },
      },
    },
  });

  const lines: PurchaseLine[] = [];
  for (const oi of items) {
    if (!oi.meal) continue;
    for (const mi of oi.meal.ingredients) {
      lines.push({
        ingredientId: mi.ingredient.id,
        name: mi.ingredient.name,
        unit: mi.unit,
        costPerUnitCents: mi.ingredient.costPerUnitCents,
        netQty: mi.qty * oi.qty,
        trimBps: mi.trimBps,
      });
    }
  }
  const { rows } = buildShoppingList(lines);

  // Deduct gross usage from each ingredient's stock (floor at 0).
  await db.$transaction(
    rows.map((r) =>
      db.ingredient.update({
        where: { id: r.ingredientId },
        data: { stockQty: { decrement: r.grossQty } },
      }),
    ),
  );
  // Clamp any negatives to 0.
  await db.ingredient.updateMany({
    where: { businessId: business.id, stockQty: { lt: 0 } },
    data: { stockQty: 0 },
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/purchasing");
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { plateCostFromRecipe } from "@/lib/profitability";
import { ingredientLossCents, mealLossCents, LOSS_REASONS } from "@/lib/loss";

export type LogLossResult = { ok: boolean; message?: string };

const Reason = z.enum(LOSS_REASONS as [string, ...string[]]);

const IngredientLoss = z.object({
  ingredientId: z.string().min(1),
  qty: z.coerce.number().positive("Enter a quantity greater than 0"),
  reason: Reason,
  note: z.string().trim().max(300).optional(),
});

/**
 * Log a raw-ingredient loss (spoilage, pests, expiry). Books the food-cost value
 * and decrements on-hand stock — the food is physically gone.
 */
export async function logIngredientLoss(input: z.infer<typeof IngredientLoss>): Promise<LogLossResult> {
  const { business, userId } = await requireOwner();
  const parsed = IngredientLoss.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid loss." };
  const d = parsed.data;

  const ing = await db.ingredient.findFirst({
    where: { id: d.ingredientId, businessId: business.id },
    select: { id: true, name: true, unit: true, costPerUnitCents: true },
  });
  if (!ing) return { ok: false, message: "Ingredient not found." };

  const costCents = ingredientLossCents(d.qty, ing.costPerUnitCents);

  await db.$transaction([
    db.lossEvent.create({
      data: {
        businessId: business.id,
        kind: "ingredient",
        reason: d.reason as (typeof LOSS_REASONS)[number],
        ingredientId: ing.id,
        itemName: ing.name,
        qty: d.qty,
        unit: ing.unit,
        costCents,
        restockedFromInventory: true,
        note: d.note || null,
        createdByUserId: userId,
      },
    }),
    db.ingredient.update({
      where: { id: ing.id },
      data: { stockQty: { decrement: d.qty } },
    }),
  ]);
  // Never let stock go negative.
  await db.ingredient.updateMany({
    where: { id: ing.id, stockQty: { lt: 0 } },
    data: { stockQty: 0 },
  });

  revalidatePath("/dashboard/waste");
  revalidatePath("/dashboard/inventory");
  return { ok: true, message: `Logged — ${ing.name} loss recorded.` };
}

const MealLoss = z.object({
  mealId: z.string().min(1),
  qty: z.coerce.number().int().positive("Enter how many meals"),
  reason: Reason,
  note: z.string().trim().max(300).optional(),
  orderId: z.string().optional(),
});

/**
 * Log a finished-meal loss (dropped in transit, remake, order error). Books the
 * plate cost per meal. Does NOT touch ingredient stock — the meal was already
 * produced (its ingredients left stock when cooked); this is a P&L event.
 */
export async function logMealLoss(input: z.infer<typeof MealLoss>): Promise<LogLossResult> {
  const { business, userId } = await requireOwner();
  const parsed = MealLoss.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid loss." };
  const d = parsed.data;

  const meal = await db.meal.findFirst({
    where: { id: d.mealId, businessId: business.id },
    select: {
      id: true,
      name: true,
      ingredients: { select: { qty: true, unit: true, trimBps: true, ingredient: { select: { unit: true, costPerUnitCents: true, densityGPerMl: true } } } },
    },
  });
  if (!meal) return { ok: false, message: "Meal not found." };

  const plateCost = plateCostFromRecipe(meal.ingredients);
  const costCents = mealLossCents(d.qty, plateCost);

  await db.lossEvent.create({
    data: {
      businessId: business.id,
      kind: "meal",
      reason: d.reason as (typeof LOSS_REASONS)[number],
      mealId: meal.id,
      orderId: d.orderId || null,
      itemName: meal.name,
      qty: d.qty,
      unit: null,
      costCents,
      restockedFromInventory: false,
      note: d.note || null,
      createdByUserId: userId,
    },
  });

  revalidatePath("/dashboard/waste");
  return { ok: true, message: `Logged — ${d.qty} × ${meal.name} loss recorded.` };
}

/** Remove a mistakenly-logged loss (owner only). Does not restore stock. */
export async function deleteLoss(id: string): Promise<LogLossResult> {
  const { business } = await requireOwner();
  const loss = await db.lossEvent.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
  if (!loss) return { ok: false, message: "Not found." };
  await db.lossEvent.delete({ where: { id: loss.id } });
  revalidatePath("/dashboard/waste");
  return { ok: true };
}

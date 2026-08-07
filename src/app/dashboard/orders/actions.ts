"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { plateCostFromRecipe } from "@/lib/profitability";
import { mealLossCents } from "@/lib/loss";

const ORDER_STATUSES = [
  "pending",
  "paid",
  "in_production",
  "packed",
  "out_for_delivery",
  "fulfilled",
  "canceled",
  "refunded",
] as const;

const UpdateStatusInput = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
});

export async function updateOrderStatus(formData: FormData) {
  const { business } = await requireBusiness();
  const parsed = UpdateStatusInput.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  // Tenant guard: only touch orders belonging to this business.
  const order = await db.order.findFirst({
    where: { id: parsed.data.orderId, businessId: business.id },
    select: { id: true },
  });
  if (!order) return;

  await db.order.update({
    where: { id: parsed.data.orderId },
    data: { status: parsed.data.status },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  revalidatePath("/dashboard");
}

// Reasons that can trace to a specific order (a subset of all LossReasons).
const ORDER_LOSS_REASONS = ["dropped_in_transit", "order_error", "remake"] as const;

const OrderLossInput = z.object({
  orderId: z.string().min(1),
  mealId: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  reason: z.enum(ORDER_LOSS_REASONS),
  note: z.string().trim().max(300).optional(),
});

export type OrderLossResult = { ok: boolean; message?: string };

/**
 * Record a food loss tied to an order — a meal dropped in transit, an order
 * error, or a remake (cooked twice for one sale). Books the plate cost so the
 * P&L reflects it, WITHOUT changing the order's revenue (the customer was still
 * charged once). Staff can log this — it's an operational event; the dollar
 * value only surfaces on the owner's Waste & P&L views.
 */
export async function logOrderLoss(input: z.infer<typeof OrderLossInput>): Promise<OrderLossResult> {
  const { business, userId } = await requireBusiness();
  const parsed = OrderLossInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid loss." };
  const d = parsed.data;

  // The order must belong to this tenant and actually contain this meal.
  const order = await db.order.findFirst({
    where: { id: d.orderId, businessId: business.id },
    select: { id: true, items: { where: { mealId: d.mealId }, select: { id: true } } },
  });
  if (!order) return { ok: false, message: "Order not found." };
  if (order.items.length === 0) return { ok: false, message: "That meal isn't on this order." };

  const meal = await db.meal.findFirst({
    where: { id: d.mealId, businessId: business.id },
    select: {
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
      reason: d.reason,
      mealId: d.mealId,
      orderId: order.id,
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
  revalidatePath(`/dashboard/orders/${order.id}`);
  return { ok: true, message: `Logged — ${d.qty} × ${meal.name} recorded as a loss for this order.` };
}

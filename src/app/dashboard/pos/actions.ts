"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { computeOrder } from "@/lib/pricing";
import { orderLimitStatus } from "@/lib/usage";
import type { TierKey } from "@/lib/tiers";

const PosInput = z.object({
  items: z
    .array(z.object({ mealId: z.string().min(1), qty: z.number().int().min(1).max(99) }))
    .min(1, "Add at least one item."),
  customerName: z.string().trim().max(120).optional().default(""),
});

export type PosResult =
  | { ok: true; orderId: string; totalCents: number }
  | { ok: false; message: string };

export async function placePosOrder(input: z.infer<typeof PosInput>): Promise<PosResult> {
  const parsed = PosInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid sale." };

  const { business } = await requireBusiness();
  const settings = await db.businessSettings.findUnique({ where: { businessId: business.id } });
  if (!settings) return { ok: false, message: "Settings missing." };

  // Plan order-cap: block new sales once the monthly allowance is used up.
  const usage = await orderLimitStatus({ id: business.id, tier: business.tier as TierKey });
  if (usage.atLimit) {
    return {
      ok: false,
      message: `You've hit your ${usage.tier} plan limit of ${usage.limit} orders this month. Upgrade in Settings to keep taking orders.`,
    };
  }

  // Authoritative prices from the DB (never trust the client).
  const meals = await db.meal.findMany({
    where: { id: { in: parsed.data.items.map((i) => i.mealId) }, businessId: business.id, active: true },
  });
  const byId = new Map(meals.map((m) => [m.id, m]));

  const lineItems = parsed.data.items.map((i) => {
    const meal = byId.get(i.mealId);
    if (!meal) throw new Error("MEAL_UNAVAILABLE");
    return { mealId: meal.id, qty: i.qty, unitPriceCentsSnapshot: meal.priceCents, nameSnapshot: meal.name };
  });

  // In-store sale: tax applies, no delivery/processing fees, no minimum or sub discount.
  const totals = computeOrder({
    lines: lineItems.map((li) => ({ priceCents: li.unitPriceCentsSnapshot, qty: li.qty })),
    settings: {
      subDiscountBps: 0,
      taxRateBps: settings.taxRateBps,
      deliveryFeeCents: 0,
      processingFeeCents: 0,
      minOrderCents: 0,
    },
    subscribe: false,
  });

  const order = await db.order.create({
    data: {
      businessId: business.id,
      type: "pos",
      status: "paid", // in-person tender
      fulfillment: "pickup",
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      feesCents: 0,
      totalCents: totals.totalCents,
      address: parsed.data.customerName ? `Walk-in: ${parsed.data.customerName}` : null,
      items: { create: lineItems },
    },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return { ok: true, orderId: order.id, totalCents: totals.totalCents };
}

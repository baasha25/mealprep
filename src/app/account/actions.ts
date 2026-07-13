"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { getCustomerContext } from "@/lib/customer-auth";
import { advanceDeliveryDate, canModifyNextDelivery, canPause, canResume } from "@/lib/subscriptions";

/** Best-effort sync of a subscription state change to Stripe (never throws). */
async function syncStripe(
  stripeSubscriptionId: string | null,
  action: "pause" | "resume" | "cancel",
): Promise<void> {
  if (!STRIPE_ENABLED || !stripeSubscriptionId) return;
  try {
    if (action === "cancel") {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
    } else if (action === "pause") {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        pause_collection: { behavior: "void" },
      });
    } else {
      await stripe.subscriptions.update(stripeSubscriptionId, { pause_collection: null });
    }
  } catch (err) {
    console.error(`[stripe] subscription ${action} failed:`, err);
  }
}

export type SubActionResult = { ok: boolean; message: string };

// Load a subscription and confirm it belongs to the current customer.
async function loadOwnedSubscription(subscriptionId: string) {
  const ctx = await getCustomerContext();
  if (!ctx) return null;
  const sub = await db.subscription.findFirst({
    where: { id: subscriptionId, customerId: ctx.customer.id },
  });
  return sub ? { sub, customer: ctx.customer } : null;
}

export async function pauseSubscription(subscriptionId: string): Promise<SubActionResult> {
  const owned = await loadOwnedSubscription(subscriptionId);
  if (!owned) return { ok: false, message: "Subscription not found." };
  if (!canPause(owned.sub.status as "active" | "paused" | "canceled"))
    return { ok: false, message: "This subscription can't be paused." };

  await db.subscription.update({ where: { id: subscriptionId }, data: { status: "paused" } });
  await syncStripe(owned.sub.stripeSubscriptionId, "pause");
  revalidatePath("/store/[slug]/account", "page");
  return { ok: true, message: "Subscription paused." };
}

export async function resumeSubscription(subscriptionId: string): Promise<SubActionResult> {
  const owned = await loadOwnedSubscription(subscriptionId);
  if (!owned) return { ok: false, message: "Subscription not found." };
  if (!canResume(owned.sub.status as "active" | "paused" | "canceled"))
    return { ok: false, message: "This subscription isn't paused." };

  await db.subscription.update({ where: { id: subscriptionId }, data: { status: "active" } });
  await syncStripe(owned.sub.stripeSubscriptionId, "resume");
  revalidatePath("/store/[slug]/account", "page");
  return { ok: true, message: "Subscription resumed." };
}

export async function cancelSubscription(subscriptionId: string): Promise<SubActionResult> {
  const owned = await loadOwnedSubscription(subscriptionId);
  if (!owned) return { ok: false, message: "Subscription not found." };
  if (owned.sub.status === "canceled")
    return { ok: false, message: "This subscription is already canceled." };

  await db.subscription.update({ where: { id: subscriptionId }, data: { status: "canceled" } });
  await syncStripe(owned.sub.stripeSubscriptionId, "cancel");
  revalidatePath("/store/[slug]/account", "page");
  return { ok: true, message: "Your subscription has been canceled." };
}

export async function skipNextDelivery(subscriptionId: string): Promise<SubActionResult> {
  const owned = await loadOwnedSubscription(subscriptionId);
  if (!owned) return { ok: false, message: "Subscription not found." };
  const { sub } = owned;

  if (
    !canModifyNextDelivery(
      sub.status as "active" | "paused" | "canceled",
      new Date(),
      sub.nextDeliveryDate,
    )
  ) {
    return { ok: false, message: "Past the cut-off — this delivery is locked." };
  }

  const current = sub.nextDeliveryDate!;
  const next = advanceDeliveryDate(current, sub.frequency as "weekly" | "biweekly");

  // Advance the cycle and carry the meal selection forward to the new date.
  await db.$transaction([
    db.subscription.update({ where: { id: subscriptionId }, data: { nextDeliveryDate: next } }),
    db.subscriptionSelection.updateMany({
      where: { subscriptionId, deliveryDate: current },
      data: { deliveryDate: next },
    }),
  ]);

  revalidatePath("/store/[slug]/account", "page");
  return { ok: true, message: "Next delivery skipped." };
}

const UpdateSelectionInput = z.object({
  subscriptionId: z.string().min(1),
  items: z.array(z.object({ mealId: z.string().min(1), qty: z.number().int().min(1).max(99) })).max(50),
});

export async function updateSelection(input: {
  subscriptionId: string;
  items: { mealId: string; qty: number }[];
}): Promise<SubActionResult> {
  const parsed = UpdateSelectionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid selection." };

  const owned = await loadOwnedSubscription(parsed.data.subscriptionId);
  if (!owned) return { ok: false, message: "Subscription not found." };
  const { sub, customer } = owned;

  if (
    !canModifyNextDelivery(
      sub.status as "active" | "paused" | "canceled",
      new Date(),
      sub.nextDeliveryDate,
    )
  ) {
    return { ok: false, message: "Past the cut-off — this delivery is locked." };
  }

  // Only allow meals that are active for this business (tenant guard).
  const mealIds = parsed.data.items.map((i) => i.mealId);
  const validMeals = await db.meal.findMany({
    where: { id: { in: mealIds }, businessId: customer.businessId, active: true },
    select: { id: true },
  });
  const validIds = new Set(validMeals.map((m) => m.id));
  const items = parsed.data.items.filter((i) => validIds.has(i.mealId));
  if (items.length === 0) return { ok: false, message: "Pick at least one meal." };

  const deliveryDate = sub.nextDeliveryDate!;

  // Replace the selection's items for the upcoming delivery.
  await db.$transaction(async (tx) => {
    const selection = await tx.subscriptionSelection.upsert({
      where: { subscriptionId_deliveryDate: { subscriptionId: sub.id, deliveryDate } },
      create: { subscriptionId: sub.id, deliveryDate },
      update: {},
    });
    await tx.subscriptionSelectionItem.deleteMany({ where: { selectionId: selection.id } });
    await tx.subscriptionSelectionItem.createMany({
      data: items.map((i) => ({ selectionId: selection.id, mealId: i.mealId, qty: i.qty })),
    });
  });

  revalidatePath("/store/[slug]/account", "page");
  return { ok: true, message: "Meals updated for your next delivery." };
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, assertWritable } from "@/lib/auth";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { pickRefundableCharge, refundParamsFor, type ChargeLike } from "@/lib/subscription-refund";
import { sendSubscriptionCanceledByKitchen, sendSubscriptionRefund } from "@/lib/email";
import { formatCents } from "@/lib/money";

export type OwnerSubResult = { ok: boolean; message: string };
export type SubBilling = {
  lastPayment: { amountCents: number; refundedCents: number; date: string; chargeId: string } | null;
  stripe: boolean; // has a Stripe subscription at all
};

// Owner-side control over a subscriber's plan. Subscription charges live on
// PrepFlow's platform Stripe account (destination charges to the kitchen), so
// the kitchen can't cancel or refund them from their own Stripe dashboard —
// this is the only place they can.

async function ownedSub(subscriptionId: string) {
  const { business } = await requireOwner();
  await assertWritable(business);
  const sub = await db.subscription.findFirst({
    where: { id: subscriptionId, businessId: business.id },
    include: { customer: { select: { id: true, name: true, email: true, stripeCustomerId: true } }, plan: { select: { name: true } } },
  });
  return sub ? { business, sub } : null;
}

async function stripeCustomerIdFor(sub: { stripeSubscriptionId: string | null; customer: { stripeCustomerId: string | null } }): Promise<string | null> {
  if (sub.customer.stripeCustomerId) return sub.customer.stripeCustomerId;
  if (!sub.stripeSubscriptionId) return null;
  const s = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  return typeof s.customer === "string" ? s.customer : s.customer.id;
}

/** The subscriber's most recent subscription charge (for the Refund button's label). */
export async function loadSubscriptionBilling(subscriptionId: string): Promise<SubBilling> {
  const owned = await ownedSub(subscriptionId);
  if (!owned) return { lastPayment: null, stripe: false };
  const { sub } = owned;
  if (!STRIPE_ENABLED || !sub.stripeSubscriptionId) return { lastPayment: null, stripe: false };
  try {
    const customer = await stripeCustomerIdFor(sub);
    if (!customer) return { lastPayment: null, stripe: true };
    const charges = await stripe.charges.list({ customer, limit: 10 });
    const latest = [...charges.data].filter((c) => c.status === "succeeded").sort((a, b) => b.created - a.created)[0];
    if (!latest) return { lastPayment: null, stripe: true };
    return {
      stripe: true,
      lastPayment: { amountCents: latest.amount, refundedCents: latest.amount_refunded, date: new Date(latest.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }), chargeId: latest.id },
    };
  } catch (err) {
    console.error("[owner-sub] billing lookup failed:", err);
    return { lastPayment: null, stripe: true };
  }
}

/** Cancel a subscriber's plan now: Stripe (if any), our row, and any un-fulfilled future orders. */
export async function cancelSubscriptionByOwner(subscriptionId: string): Promise<OwnerSubResult> {
  const owned = await ownedSub(subscriptionId);
  if (!owned) return { ok: false, message: "Subscription not found." };
  const { business, sub } = owned;
  if (sub.status === "canceled") return { ok: false, message: "Already cancelled." };
  if (STRIPE_ENABLED && sub.stripeSubscriptionId && !business.isDemo) {
    try {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (!/No such subscription|already been canceled|canceled subscription/i.test(msg)) {
        console.error("[owner-sub] Stripe cancel failed:", err);
        return { ok: false, message: "Stripe couldn't cancel the subscription. Try again in a minute." };
      }
    }
  }
  await db.$transaction([
    db.subscription.update({ where: { id: sub.id }, data: { status: "canceled" } }),
    // Orders already generated for deliveries that haven't gone out yet.
    db.order.updateMany({ where: { subscriptionId: sub.id, status: { in: ["paid", "in_production", "packed"] }, deliveryDate: { gt: new Date() } }, data: { status: "canceled" } }),
  ]);
  if (sub.customer.email) {
    await sendSubscriptionCanceledByKitchen({ to: sub.customer.email, businessId: business.id, businessName: business.name, brandColor: business.brandColor, customerName: sub.customer.name, planName: sub.plan.name });
  }
  revalidatePath("/dashboard/subscriptions");
  return { ok: true, message: `${sub.customer.name}'s ${sub.plan.name} plan is cancelled. No further charges.` };
}

/** Refund the subscriber's most recent payment in full — reversing the transfer and the platform fee on Connect. */
export async function refundLastPaymentByOwner(subscriptionId: string): Promise<OwnerSubResult> {
  const owned = await ownedSub(subscriptionId);
  if (!owned) return { ok: false, message: "Subscription not found." };
  const { business, sub } = owned;
  if (!STRIPE_ENABLED || !sub.stripeSubscriptionId || business.isDemo) return { ok: false, message: "No Stripe payment to refund for this plan." };
  try {
    const customer = await stripeCustomerIdFor(sub);
    if (!customer) return { ok: false, message: "No Stripe customer on file." };
    const charges = await stripe.charges.list({ customer, limit: 10 });
    const charge = pickRefundableCharge(charges.data as unknown as ChargeLike[]);
    if (!charge) return { ok: false, message: "Nothing left to refund — the last payment is already refunded." };
    const params = refundParamsFor(charge);
    const refund = await stripe.refunds.create({ ...params, reason: "requested_by_customer", metadata: { subscriptionId: sub.id, businessId: business.id, by: "kitchen" } });
    // Mirror on the order this payment covered, if one exists and hasn't gone out.
    await db.order.updateMany({ where: { subscriptionId: sub.id, status: { in: ["paid", "in_production", "packed"] }, deliveryDate: { gt: new Date() } }, data: { status: "refunded" } });
    if (sub.customer.email) {
      await sendSubscriptionRefund({ to: sub.customer.email, businessId: business.id, businessName: business.name, brandColor: business.brandColor, customerName: sub.customer.name, amountCents: params.amount });
    }
    revalidatePath("/dashboard/subscriptions");
    return { ok: true, message: `Refunded ${formatCents(params.amount)} to ${sub.customer.name}${params.reverse_transfer ? " (transfer reversed, fee refunded)" : ""}. Refund ${refund.id.slice(-6)}.` };
  } catch (err) {
    console.error("[owner-sub] refund failed:", err);
    return { ok: false, message: "Stripe couldn't issue the refund. Try again in a minute, or refund from your Stripe dashboard." };
  }
}

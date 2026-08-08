"use server";

import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { appUrl } from "@/lib/app-url";
import { isTierKey, type TierKey } from "@/lib/tiers";
import { KITCHEN_BILLING_ENABLED, tierPriceId, tierFromPriceId } from "@/lib/kitchen-billing";
import { activateKitchenSubscription } from "@/lib/kitchen-billing-sync";

export type BillingActionResult = { ok: true; url: string } | { ok: false; message: string };

/** Get-or-create the kitchen's Stripe Customer on the PLATFORM account. */
async function ensureBillingCustomer(businessId: string, name: string, existing: string | null): Promise<string> {
  if (existing) return existing;
  const owner = await db.user.findFirst({ where: { businessId, role: "owner" }, select: { email: true } });
  const customer = await stripe.customers.create({
    email: owner?.email || undefined,
    name,
    metadata: { businessId, kind: "kitchen_billing" },
  });
  await db.business.update({ where: { id: businessId }, data: { billingCustomerId: customer.id } });
  return customer.id;
}

/** Start (or switch to) a paid plan via Stripe Checkout — the kitchen pays PrepFlow. */
export async function startKitchenSubscription(tier: string): Promise<BillingActionResult> {
  const { business } = await requireOwner();
  if (business.isDemo) return { ok: false, message: "This is a demo — claim your kitchen to set up billing." };
  if (!KITCHEN_BILLING_ENABLED) return { ok: false, message: "Billing isn't switched on yet." };
  if (!isTierKey(tier)) return { ok: false, message: "Unknown plan." };
  const price = tierPriceId(tier);
  if (!price) return { ok: false, message: "That plan isn't available." };

  // Already subscribed → send them to the portal to switch plans instead.
  if (business.billingStatus === "active" && business.billingSubscriptionId) {
    return { ok: false, message: "You're already subscribed — use Manage billing to change plans." };
  }

  const customer = await ensureBillingCustomer(business.id, business.name, business.billingCustomerId);
  const origin = await appUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    metadata: { kind: "kitchen_billing", businessId: business.id, tier },
    subscription_data: { metadata: { kind: "kitchen_billing", businessId: business.id, tier } },
    success_url: `${origin}/dashboard/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/billing?canceled=1`,
  });
  return session.url ? { ok: true, url: session.url } : { ok: false, message: "Couldn't start checkout." };
}

/** Open Stripe's hosted billing portal (update card, invoices, switch/cancel plan). */
export async function openBillingPortal(): Promise<BillingActionResult> {
  const { business } = await requireOwner();
  if (!business.billingCustomerId) return { ok: false, message: "No billing account yet — pick a plan first." };
  const origin = await appUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: business.billingCustomerId,
    configuration: process.env.STRIPE_PORTAL_CONFIG_ID || undefined,
    return_url: `${origin}/dashboard/billing`,
  });
  return session.url ? { ok: true, url: session.url } : { ok: false, message: "Couldn't open the billing portal." };
}

/**
 * Fast-path used by the success redirect (?subscribed=1): retrieve the Checkout
 * session and mark the kitchen active immediately, so the UI reflects it without
 * waiting on the webhook. Idempotent — the webhook is still the source of truth.
 */
export async function confirmCheckout(sessionId: string): Promise<void> {
  const { business } = await requireOwner();
  if (!sessionId) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.metadata?.kind !== "kitchen_billing" || session.metadata?.businessId !== business.id) return;
    if (session.payment_status !== "paid" && session.status !== "complete") return;
    const sub = session.subscription;
    const subId = typeof sub === "string" ? sub : sub?.id;
    if (!subId) return;
    const priceTier = tierFromPriceId(
      typeof sub === "object" && sub ? sub.items?.data?.[0]?.price?.id : undefined,
    );
    const tier = (isTierKey(session.metadata?.tier) ? session.metadata.tier : priceTier) as TierKey | null;
    if (!tier) return;
    await activateKitchenSubscription({ businessId: business.id, subscriptionId: subId, tier });
  } catch (err) {
    console.error("[billing] confirmCheckout failed:", err);
  }
}

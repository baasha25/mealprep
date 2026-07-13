import type Stripe from "stripe";
import { db } from "@/lib/db";
import { referralCodeFrom } from "@/lib/loyalty";

/**
 * Create our Subscription row from a completed subscription-mode Checkout
 * session, if it doesn't exist yet. Idempotent (keyed on stripeSubscriptionId),
 * so the success-redirect page and the webhook can both call it safely.
 * Returns the plan name for display, or null if nothing was created/found.
 */
export async function ensureSubscriptionFromCheckout(
  session: Stripe.Checkout.Session,
): Promise<{ planName: string } | null> {
  const subId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const businessId = session.metadata?.businessId;
  const planId = session.metadata?.planId;
  const frequency = session.metadata?.frequency === "biweekly" ? "biweekly" : "weekly";
  const custId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  const email = (session.customer_details?.email ?? session.customer_email ?? "")
    .trim()
    .toLowerCase();
  const name = session.customer_details?.name ?? (email ? email.split("@")[0] : "there");

  if (!subId || !businessId || !planId || !email) return null;

  const plan = await db.plan.findFirst({ where: { id: planId, businessId } });
  if (!plan) return null;

  const already = await db.subscription.findFirst({ where: { stripeSubscriptionId: subId } });
  if (already) return { planName: plan.name };

  const customer = await db.customer.upsert({
    where: { businessId_email: { businessId, email } },
    create: {
      businessId,
      name,
      email,
      stripeCustomerId: custId,
      referralCode: referralCodeFrom(name, Date.now() % 100000),
    },
    update: { stripeCustomerId: custId },
  });

  await db.subscription.create({
    data: {
      businessId,
      customerId: customer.id,
      planId: plan.id,
      status: "active",
      frequency,
      nextDeliveryDate: new Date(Date.now() + 5 * 86_400_000),
      stripeSubscriptionId: subId,
    },
  });

  return { planName: plan.name };
}

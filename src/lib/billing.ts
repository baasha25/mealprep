import type Stripe from "stripe";
import { db } from "@/lib/db";
import { referralCodeFrom } from "@/lib/loyalty";
import { appUrl } from "@/lib/app-url";
import { sendSubscriptionConfirmation } from "@/lib/email";
import { nextCutoffAt, upcomingDeliveries, DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { enabledDeliveryDays, sanitizePreferredDays } from "@/lib/delivery-days";

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

  // Align the first delivery to a real delivery day the customer chose (falling
  // back to the kitchen's own delivery days), after the next order cut-off —
  // instead of a blind "now + 5 days". The chosen day(s) are also stored so the
  // account page can split the plan across them.
  const settingsRow = await db.businessSettings.findUnique({ where: { businessId } });
  const tz = settingsRow?.timezone || DEFAULT_TIMEZONE;
  const enabled = enabledDeliveryDays((settingsRow?.deliveryDays ?? {}) as Record<string, boolean>);
  const chosen = sanitizePreferredDays(
    (session.metadata?.deliveryDays ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    enabled,
  );
  const effectiveDays = chosen.length ? chosen : enabled;
  const anchor = (settingsRow ? nextCutoffAt(settingsRow.cutoff, tz) : null) ?? new Date();
  const nextDeliveryDate =
    upcomingDeliveries(effectiveDays, anchor, tz, 1, frequency)[0] ??
    new Date(Date.now() + 5 * 86_400_000);

  await db.subscription.create({
    data: {
      businessId,
      customerId: customer.id,
      planId: plan.id,
      status: "active",
      frequency,
      nextDeliveryDate,
      preferredDeliveryDays: chosen,
      stripeSubscriptionId: subId,
    },
  });

  // Immediate "you're subscribed" email — best-effort, not webhook-dependent, and
  // only here (past the idempotency check) so it sends exactly once per sub.
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true, brandColor: true, slug: true },
  });
  if (business?.slug) {
    const base = await appUrl();
    await sendSubscriptionConfirmation({
      to: email,
      customerName: customer.name,
      businessName: business.name,
      brandColor: business.brandColor,
      planName: plan.name,
      nextDeliveryLabel: nextDeliveryDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      accountUrl: `${base}/store/${business.slug}/account`,
    });
  }

  return { planName: plan.name };
}

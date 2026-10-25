import type Stripe from "stripe";
import { db } from "@/lib/db";
import { referralCodeFrom } from "@/lib/loyalty";
import { appUrl } from "@/lib/app-url";
import { sendSubscriptionConfirmation } from "@/lib/email";
import { nextCutoffAt, upcomingDeliveries, DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { enabledDeliveryDays, sanitizePreferredDays } from "@/lib/delivery-days";
import { kitchenDaysWithZones, zoneForPostal, zoneDays, type ZoneLike } from "@/lib/zones";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { describeDeliveryDays } from "@/lib/delivery-days";

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
  // Zone (from the postal code typed at sign-up): its days bound the choice,
  // and its name/fee are kept on the subscription for Orders + Routes.
  const zoneRows = await db.deliveryZone.findMany({ where: { businessId, active: true } });
  const zones: ZoneLike[] = zoneRows.map((z) => ({ ...z, deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean> }));
  const kitchenDayMap = kitchenDaysWithZones((settingsRow?.deliveryDays ?? {}) as Record<string, boolean>, zones);
  const postalCode = (session.metadata?.postalCode ?? "").trim() || null;
  const zone = zoneForPostal(postalCode, zones);
  const enabled = enabledDeliveryDays(zoneDays(zone, kitchenDayMap));
  const deliveryFeeCents = Math.max(0, parseInt(session.metadata?.deliveryFeeCents ?? "0", 10) || 0);
  // The Stripe line that carries the fee (so a zone change can re-price it).
  let stripeFeeItemId: string | null = null;
  if (STRIPE_ENABLED && (zone || deliveryFeeCents > 0)) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price.product"] });
      const feeItem = stripeSub.items.data.find((it) => {
        const prod = it.price.product;
        return typeof prod === "object" && prod && "metadata" in prod && prod.metadata?.kind === "delivery_fee";
      });
      stripeFeeItemId = feeItem?.id ?? null;
    } catch (err) {
      console.error("[billing] could not read subscription items:", err);
    }
  }
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
      postalCode,
      zone: zone?.name ?? (session.metadata?.zone || null),
      deliveryFeeCents,
      stripeFeeItemId,
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
      businessId,
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
      deliveryLine: zone
        ? `${zone.name} · ${describeDeliveryDays(effectiveDays)}${deliveryFeeCents > 0 ? ` · ${(deliveryFeeCents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" })} delivery each week` : " · free delivery"}`
        : null,
    });
  }

  return { planName: plan.name };
}

/**
 * Demo kitchens: start a plan with no Stripe at all. Creates the customer and
 * the subscription exactly as a paid checkout would (zone, days, fee, first
 * delivery after the next cut-off), so the sandbox account page, Kitchen OS
 * and Routes behave like the real thing. Only ever called for isDemo tenants.
 */
export async function createDemoSubscription(input: {
  businessId: string;
  planId: string;
  frequency: "weekly" | "biweekly";
  deliveryDays: string[];
  postalCode: string | null;
  zoneName: string | null;
  deliveryFeeCents: number;
  email: string;
  name: string;
}): Promise<{ planName: string } | null> {
  const plan = await db.plan.findFirst({ where: { id: input.planId, businessId: input.businessId } });
  if (!plan) return null;
  const customer = await db.customer.upsert({
    where: { businessId_email: { businessId: input.businessId, email: input.email } },
    create: { businessId: input.businessId, name: input.name, email: input.email, referralCode: referralCodeFrom(input.name, Date.now() % 100000) },
    update: { name: input.name },
  });
  const settingsRow = await db.businessSettings.findUnique({ where: { businessId: input.businessId } });
  const tz = settingsRow?.timezone || DEFAULT_TIMEZONE;
  const zoneRows = await db.deliveryZone.findMany({ where: { businessId: input.businessId, active: true } });
  const zones: ZoneLike[] = zoneRows.map((z) => ({ ...z, deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean> }));
  const kitchenDayMap = kitchenDaysWithZones((settingsRow?.deliveryDays ?? {}) as Record<string, boolean>, zones);
  const zone = zoneForPostal(input.postalCode, zones);
  const enabled = enabledDeliveryDays(zoneDays(zone, kitchenDayMap));
  const chosen = sanitizePreferredDays(input.deliveryDays, enabled);
  const effectiveDays = chosen.length ? chosen : enabled;
  const anchor = (settingsRow ? nextCutoffAt(settingsRow.cutoff, tz) : null) ?? new Date();
  const nextDeliveryDate = upcomingDeliveries(effectiveDays, anchor, tz, 1, input.frequency)[0] ?? new Date(Date.now() + 5 * 86_400_000);
  await db.subscription.create({
    data: {
      businessId: input.businessId,
      customerId: customer.id,
      planId: plan.id,
      status: "active",
      frequency: input.frequency,
      nextDeliveryDate,
      preferredDeliveryDays: chosen,
      postalCode: input.postalCode,
      zone: zone?.name ?? input.zoneName,
      deliveryFeeCents: input.deliveryFeeCents,
      stripeSubscriptionId: null,
    },
  });
  return { planName: plan.name };
}

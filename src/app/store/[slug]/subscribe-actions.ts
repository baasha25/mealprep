"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED, PLATFORM_CURRENCY } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";
import { enabledDeliveryDays, sanitizePreferredDays } from "@/lib/delivery-days";
import { kitchenDaysWithZones, zoneForPostal, zoneDays, zoneFeeCents, normalizePostal, type ZoneLike } from "@/lib/zones";
import { subscriptionWeeklyCharge } from "@/lib/subscription-orders";
import { createDemoSubscription } from "@/lib/billing";

const Input = z.object({
  slug: z.string().min(1),
  planId: z.string().min(1),
  frequency: z.enum(["weekly", "biweekly"]),
  email: z.string().trim().toLowerCase().email().optional(),
  // Weekday(s) the customer wants to receive on — validated against the kitchen's
  // own delivery days server-side below.
  deliveryDays: z.array(z.string()).max(7).optional(),
  // Zone-based delivery: required when the kitchen has zones; picks the zone,
  // which picks the days on offer and the weekly delivery fee.
  postalCode: z.string().trim().max(20).optional(),
});

export type SubscribeResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/**
 * Start a recurring subscription to a plan via Stripe Checkout (subscription
 * mode). The plan's weekly total is charged every 1 or 2 weeks. The subscription
 * row is created on the success redirect (see /store/[slug]/subscribed).
 */
export async function startPlanSubscription(input: unknown): Promise<SubscribeResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { slug, planId, frequency, email } = parsed.data;

  const business = await getStorefrontBusiness(slug);
  if (!business) return { ok: false, message: "Store unavailable." };

  if (!STRIPE_ENABLED && !business.isDemo) {
    return { ok: false, message: "Online subscriptions aren't available yet." };
  }

  // Zone from the postal code (when the kitchen runs zones): it narrows the
  // delivery days to the zone's and sets the weekly delivery fee. No zones =
  // the kitchen's days and no delivery fee on the plan, exactly as before.
  const zoneRows = await db.deliveryZone.findMany({ where: { businessId: business.id, active: true } });
  const zones: ZoneLike[] = zoneRows.map((z) => ({ ...z, deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean> }));
  const kitchenDayMap = kitchenDaysWithZones((business.settings?.deliveryDays ?? {}) as Record<string, boolean>, zones);
  let zone: ZoneLike | null = null;
  if (zones.length) {
    zone = zoneForPostal(parsed.data.postalCode, zones);
    if (!zone) {
      return { ok: false, message: parsed.data.postalCode ? `We don't deliver to ${parsed.data.postalCode.toUpperCase()} yet.` : "Enter your postal code so we can find your delivery day." };
    }
  }
  const enabled = enabledDeliveryDays(zoneDays(zone, kitchenDayMap));
  const chosenDays = sanitizePreferredDays(parsed.data.deliveryDays, enabled);
  const deliveryFeeCents = zone ? zoneFeeCents(zone, business.settings?.deliveryFeeCents ?? 0) : 0;
  const postalCode = zone ? normalizePostal(parsed.data.postalCode) : "";

  const plan = await db.plan.findFirst({
    where: { id: planId, businessId: business.id, active: true },
  });
  if (!plan) return { ok: false, message: "That plan isn't available." };

  const intervalCount: 1 | 2 = frequency === "biweekly" ? 2 : 1;
  // Charge N weeks of meals every N weeks (same effective weekly rate), plus the
  // zone's delivery fee for each of those weeks as its own line.
  const charge = subscriptionWeeklyCharge({ mealsPerWeek: plan.mealsPerWeek, perMealPriceCents: plan.perMealPriceCents, deliveryFeeCents, intervalCount });
  const chargeCents = charge.planCents;

  // Sales sandbox: no Stripe. The plan starts immediately for a demo customer so
  // the prospect can see the account page, picks, Kitchen OS and Routes fill in.
  if (business.isDemo) {
    const r = await createDemoSubscription({
      businessId: business.id,
      planId: plan.id,
      frequency,
      deliveryDays: chosenDays,
      postalCode: postalCode || null,
      zoneName: zone?.name ?? null,
      deliveryFeeCents,
      email: `demo.customer@${business.slug ?? "demo"}.prepflow.test`,
      name: "Jordan Demo",
    });
    return r ? { ok: true, url: `/store/${slug}/subscribed?demo=1` } : { ok: false, message: "Couldn't start the demo plan." };
  }

  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Connect: recurring charges go to the kitchen's account with PrepFlow's
  // platform fee %; otherwise they stay on the platform account (test/demo).
  const connected = business.stripeChargesEnabled && business.stripeAccountId;
  const feePct = (business.settings?.platformFeeBps ?? 0) / 100;

  const subMeta = {
    businessId: business.id,
    planId: plan.id,
    frequency,
    deliveryDays: chosenDays.join(","),
    postalCode,
    zone: zone?.name ?? "",
    deliveryFeeCents: String(deliveryFeeCents),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PLATFORM_CURRENCY,
          product_data: { name: `${business.name} — ${plan.name}` },
          unit_amount: chargeCents,
          recurring: { interval: "week", interval_count: intervalCount },
        },
      },
      // Delivery fee as its own recurring line (present whenever the kitchen
      // runs zones, even at $0, so a move to another zone can re-price it).
      ...(zone
        ? [
            {
              quantity: 1,
              price_data: {
                currency: PLATFORM_CURRENCY,
                product_data: { name: `Delivery — ${zone.name}`, metadata: { kind: "delivery_fee" } },
                unit_amount: charge.feeCents,
                recurring: { interval: "week" as const, interval_count: intervalCount },
              },
            },
          ]
        : []),
    ],
    metadata: subMeta,
    subscription_data: {
      metadata: subMeta,
      ...(connected
        ? {
            // on_behalf_of makes the kitchen the settlement merchant, so Stripe's
            // processing fee comes out of THEIR account (pass-through), not ours.
            on_behalf_of: business.stripeAccountId!,
            application_fee_percent: feePct,
            transfer_data: { destination: business.stripeAccountId! },
          }
        : {}),
    },
    success_url: `${origin}/store/${slug}/subscribed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store/${slug}?canceled=1`,
  });

  return session.url
    ? { ok: true, url: session.url }
    : { ok: false, message: "Couldn't start checkout." };
}

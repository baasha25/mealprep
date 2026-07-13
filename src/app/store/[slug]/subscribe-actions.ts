"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";

const Input = z.object({
  slug: z.string().min(1),
  planId: z.string().min(1),
  frequency: z.enum(["weekly", "biweekly"]),
  email: z.string().trim().toLowerCase().email().optional(),
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

  if (!STRIPE_ENABLED) {
    return { ok: false, message: "Online subscriptions aren't available yet." };
  }

  const business = await getStorefrontBusiness(slug);
  if (!business) return { ok: false, message: "Store unavailable." };

  const plan = await db.plan.findFirst({
    where: { id: planId, businessId: business.id, active: true },
  });
  if (!plan) return { ok: false, message: "That plan isn't available." };

  const weeklyCents = plan.mealsPerWeek * plan.perMealPriceCents;
  const intervalCount = frequency === "biweekly" ? 2 : 1;
  // Charge N weeks of meals every N weeks (same effective weekly rate).
  const chargeCents = weeklyCents * intervalCount;

  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Connect: recurring charges go to the kitchen's account with PrepFlow's
  // platform fee %; otherwise they stay on the platform account (test/demo).
  const connected = business.stripeChargesEnabled && business.stripeAccountId;
  const feePct = (business.settings?.platformFeeBps ?? 0) / 100;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: { name: `${business.name} — ${plan.name}` },
          unit_amount: chargeCents,
          recurring: { interval: "week", interval_count: intervalCount },
        },
      },
    ],
    metadata: { businessId: business.id, planId: plan.id, frequency },
    subscription_data: {
      metadata: { businessId: business.id, planId: plan.id, frequency },
      ...(connected
        ? {
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

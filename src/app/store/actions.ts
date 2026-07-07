"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";
import { computeOrder, type AppliedCoupon } from "@/lib/pricing";
import {
  pointsForOrder,
  resolveRedemption,
  referralCodeFrom,
  redeemableValueCents,
} from "@/lib/loyalty";

/* ------------------------------- Loyalty ------------------------------- */

export type LoyaltyLookup =
  | { found: true; points: number; valueCents: number; centsPerPoint: number }
  | { found: false };

/** Look up a returning customer's points by email, for the redemption UI. */
export async function lookupLoyalty(slug: string, rawEmail: string): Promise<LoyaltyLookup> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { found: false };
  const business = await getStorefrontBusiness(slug);
  if (!business?.settings?.loyaltyEnabled) return { found: false };
  const customer = await db.customer.findFirst({
    where: { businessId: business.id, email },
    select: { loyaltyPoints: true },
  });
  if (!customer || customer.loyaltyPoints <= 0) return { found: false };
  const centsPerPoint = business.settings.loyaltyRedeemCentsPerPoint;
  return {
    found: true,
    points: customer.loyaltyPoints,
    valueCents: redeemableValueCents(customer.loyaltyPoints, centsPerPoint),
    centsPerPoint,
  };
}

/* ------------------------------- Coupons ------------------------------- */

export type CouponResult =
  | { valid: true; code: string; type: "percent" | "flat"; value: number; label: string }
  | { valid: false; message: string };

export async function lookupCoupon(slug: string, rawCode: string): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Enter a code." };

  const business = await getStorefrontBusiness(slug);
  if (!business) return { valid: false, message: "Store unavailable." };

  const coupon = await db.coupon.findFirst({
    where: { businessId: business.id, code, active: true },
  });
  if (!coupon) return { valid: false, message: "That code isn't valid." };

  const label =
    coupon.type === "percent"
      ? `${coupon.value}% off`
      : `$${(coupon.value / 100).toFixed(2)} off`;
  return { valid: true, code, type: coupon.type, value: coupon.value, label };
}

/* ----------------------------- Gift cards ------------------------------ */

export type GiftCardResult =
  | { valid: true; code: string; balanceCents: number }
  | { valid: false; message: string };

export async function lookupGiftCard(slug: string, rawCode: string): Promise<GiftCardResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Enter a code." };

  const business = await getStorefrontBusiness(slug);
  if (!business) return { valid: false, message: "Store unavailable." };

  const gc = await db.giftCard.findFirst({ where: { businessId: business.id, code } });
  if (!gc) return { valid: false, message: "That gift card isn't valid." };
  if (gc.balanceCents <= 0) return { valid: false, message: "This gift card has no balance left." };
  return { valid: true, code, balanceCents: gc.balanceCents };
}

/* ------------------------------- Checkout ------------------------------ */

const PlaceOrderInput = z.object({
  slug: z.string().min(1, "Store unavailable."),
  items: z
    .array(z.object({ mealId: z.string().min(1), qty: z.number().int().min(1).max(99) }))
    .min(1, "Your cart is empty."),
  subscribe: z.boolean(),
  couponCode: z.string().optional(),
  giftCardCode: z.string().trim().toUpperCase().max(24).optional(),
  redeemPoints: z.number().int().min(0).max(1_000_000).optional(),
  referralCode: z.string().trim().toUpperCase().max(24).optional(),
  fulfillment: z.enum(["delivery", "pickup"]),
  customer: z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: z.string().trim().max(40).optional().default(""),
    address: z.string().trim().max(200).optional().default(""),
    zone: z.string().trim().max(60).optional().default(""),
  }),
});

export type PlaceOrderInputT = z.infer<typeof PlaceOrderInput>;

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalCents: number; giftRedeemedCents: number; amountDueCents: number; subscription: boolean; checkoutUrl?: string }
  | { ok: false; message: string };

export async function placeOrder(input: PlaceOrderInputT): Promise<PlaceOrderResult> {
  const parsed = PlaceOrderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid order." };
  }
  const data = parsed.data;

  const business = await getStorefrontBusiness(data.slug);
  if (!business || !business.settings) {
    return { ok: false, message: "Store is not available." };
  }
  const s = business.settings;

  if (data.fulfillment === "delivery" && s.fulfillment === "pickup") {
    return { ok: false, message: "This kitchen only offers pickup." };
  }
  if (data.fulfillment === "pickup" && s.fulfillment === "delivery") {
    return { ok: false, message: "This kitchen only offers delivery." };
  }

  // Authoritative pricing: load meals from the DB (never trust client prices).
  const mealIds = data.items.map((i) => i.mealId);
  const meals = await db.meal.findMany({
    where: { id: { in: mealIds }, businessId: business.id, active: true },
  });
  const mealById = new Map(meals.map((m) => [m.id, m]));

  const lineItems = data.items.map((i) => {
    const meal = mealById.get(i.mealId);
    if (!meal) throw new Error("MEAL_UNAVAILABLE");
    return {
      mealId: meal.id,
      qty: i.qty,
      unitPriceCentsSnapshot: meal.priceCents,
      nameSnapshot: meal.name,
    };
  });

  // Validate coupon server-side.
  let appliedCoupon: AppliedCoupon | null = null;
  if (data.couponCode) {
    const c = await lookupCoupon(data.slug, data.couponCode);
    if (c.valid) appliedCoupon = { type: c.type, value: c.value };
  }

  // Existing customer (if any) — needed for loyalty balance + referral eligibility.
  const existing = await db.customer.findFirst({
    where: { businessId: business.id, email: data.customer.email },
    select: { id: true, loyaltyPoints: true, referredById: true, referralCode: true },
  });
  const isNewCustomer = !existing;

  // Base totals (pre-redemption) to know how much loyalty can offset.
  const base = computeOrder({
    lines: lineItems.map((li) => ({ priceCents: li.unitPriceCentsSnapshot, qty: li.qty })),
    settings: s,
    subscribe: data.subscribe,
    coupon: appliedCoupon,
  });

  if (base.itemCount === 0) return { ok: false, message: "Your cart is empty." };
  if (base.belowMinimum) {
    return { ok: false, message: `Minimum order is $${(s.minOrderCents / 100).toFixed(2)}.` };
  }

  // Loyalty redemption (only if enabled and the customer already has a balance).
  const balance = existing?.loyaltyPoints ?? 0;
  const redeemCapCents = base.subtotalCents - base.subDiscountCents - base.couponCents;
  const requestedRedeem = data.redeemPoints ?? 0;
  const redemption =
    s.loyaltyEnabled && balance > 0 && requestedRedeem > 0
      ? resolveRedemption(requestedRedeem, balance, Math.max(0, redeemCapCents), s.loyaltyRedeemCentsPerPoint)
      : { points: 0, cents: 0 };

  const totals = computeOrder({
    lines: lineItems.map((li) => ({ priceCents: li.unitPriceCentsSnapshot, qty: li.qty })),
    settings: s,
    subscribe: data.subscribe,
    coupon: appliedCoupon,
    redeemCents: redemption.cents,
  });

  // Gift card — stored-value tender applied to the final total (capped at balance).
  let giftCard: { id: string; balanceCents: number } | null = null;
  let giftAppliedCents = 0;
  if (data.giftCardCode) {
    const gc = await db.giftCard.findFirst({
      where: { businessId: business.id, code: data.giftCardCode },
      select: { id: true, balanceCents: true },
    });
    if (gc && gc.balanceCents > 0) {
      giftCard = gc;
      giftAppliedCents = Math.min(gc.balanceCents, totals.totalCents);
    }
  }

  // Resolve a referrer (valid code, belongs to this business, not the buyer).
  let referrerId: string | null = null;
  if (isNewCustomer && data.referralCode) {
    const referrer = await db.customer.findFirst({
      where: { businessId: business.id, referralCode: data.referralCode },
      select: { id: true },
    });
    if (referrer) referrerId = referrer.id;
  }

  // Upsert the customer; ensure they have a shareable referral code.
  const customer = await db.customer.upsert({
    where: { businessId_email: { businessId: business.id, email: data.customer.email } },
    create: {
      businessId: business.id,
      name: data.customer.name,
      email: data.customer.email,
      phone: data.customer.phone || null,
      referredById: referrerId,
      referralCode: referralCodeFrom(data.customer.name, Date.now() % 100000),
    },
    update: { name: data.customer.name, phone: data.customer.phone || null },
  });

  const order = await db.order.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      type: data.subscribe ? "subscription" : "one_time",
      status: "pending", // until Stripe payment is wired
      fulfillment: data.fulfillment,
      address: data.customer.address || null,
      zone: data.customer.zone || null,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      feesCents: totals.feesCents,
      totalCents: totals.totalCents,
      giftRedeemedCents: giftAppliedCents,
      items: { create: lineItems },
    },
  });

  // Spend down the gift card balance.
  if (giftCard && giftAppliedCents > 0) {
    await db.giftCard.update({
      where: { id: giftCard.id },
      data: { balanceCents: { decrement: giftAppliedCents } },
    });
  }

  // Loyalty postings: redeemed points spent, points earned, referrer bonus.
  if (s.loyaltyEnabled) {
    const earned = pointsForOrder(totals.subtotalCents, s.loyaltyPointsPerDollar);
    const net = earned - redemption.points;
    if (net !== 0) {
      await db.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: net } },
      });
    }
    if (referrerId) {
      await db.customer.update({
        where: { id: referrerId },
        data: { loyaltyPoints: { increment: s.referralBonusPoints } },
      });
    }
  }

  const amountDueCents = Math.max(0, totals.totalCents - giftAppliedCents);

  // Fully covered by gift card / points → nothing to charge; mark it paid.
  if (amountDueCents === 0) {
    await db.order.update({ where: { id: order.id }, data: { status: "paid" } });
  }

  // Otherwise send the customer to Stripe Checkout (test mode) to pay the balance.
  let checkoutUrl: string | undefined;
  if (amountDueCents > 0 && STRIPE_ENABLED) {
    const h = await headers();
    const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: data.customer.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountDueCents,
            product_data: { name: `${business.name} — ${totals.itemCount} meals`, description: `Order #${order.id.slice(-6)}` },
          },
        },
      ],
      success_url: `${origin}/store/${data.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/store/${data.slug}?canceled=1`,
    });
    await db.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: session.id } });
    checkoutUrl = session.url ?? undefined;
  }

  return {
    ok: true,
    orderId: order.id,
    totalCents: totals.totalCents,
    giftRedeemedCents: giftAppliedCents,
    amountDueCents,
    subscription: data.subscribe,
    checkoutUrl,
  };
}

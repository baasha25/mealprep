"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { computeOrder, type AppliedCoupon } from "@/lib/pricing";

/* ------------------------------- Coupons ------------------------------- */

export type CouponResult =
  | { valid: true; code: string; type: "percent" | "flat"; value: number; label: string }
  | { valid: false; message: string };

export async function lookupCoupon(rawCode: string): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Enter a code." };

  const business = await getStorefrontBusiness();
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

/* ------------------------------- Checkout ------------------------------ */

const PlaceOrderInput = z.object({
  items: z
    .array(z.object({ mealId: z.string().min(1), qty: z.number().int().min(1).max(99) }))
    .min(1, "Your cart is empty."),
  subscribe: z.boolean(),
  couponCode: z.string().optional(),
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
  | { ok: true; orderId: string; totalCents: number; subscription: boolean }
  | { ok: false; message: string };

export async function placeOrder(input: PlaceOrderInputT): Promise<PlaceOrderResult> {
  const parsed = PlaceOrderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid order." };
  }
  const data = parsed.data;

  const business = await getStorefrontBusiness();
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
    const c = await lookupCoupon(data.couponCode);
    if (c.valid) appliedCoupon = { type: c.type, value: c.value };
  }

  const totals = computeOrder({
    lines: lineItems.map((li) => ({ priceCents: li.unitPriceCentsSnapshot, qty: li.qty })),
    settings: s,
    subscribe: data.subscribe,
    coupon: appliedCoupon,
  });

  if (totals.itemCount === 0) return { ok: false, message: "Your cart is empty." };
  if (totals.belowMinimum) {
    return {
      ok: false,
      message: `Minimum order is $${(s.minOrderCents / 100).toFixed(2)}.`,
    };
  }

  // Upsert the customer by (businessId, email).
  const customer = await db.customer.upsert({
    where: {
      businessId_email: { businessId: business.id, email: data.customer.email },
    },
    create: {
      businessId: business.id,
      name: data.customer.name,
      email: data.customer.email,
      phone: data.customer.phone || null,
    },
    update: { name: data.customer.name, phone: data.customer.phone || null },
  });

  // Create the order with frozen price/name snapshots. Status is `pending`
  // until Stripe payment is wired (next module).
  const order = await db.order.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      type: data.subscribe ? "subscription" : "one_time",
      status: "pending",
      fulfillment: data.fulfillment,
      address: data.customer.address || null,
      zone: data.customer.zone || null,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      feesCents: totals.feesCents,
      totalCents: totals.totalCents,
      items: { create: lineItems },
    },
  });

  return {
    ok: true,
    orderId: order.id,
    totalCents: totals.totalCents,
    subscription: data.subscribe,
  };
}

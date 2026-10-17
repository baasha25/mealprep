"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { stripe, STRIPE_ENABLED, PLATFORM_CURRENCY } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { eventDateAllowed, eventDateToInstant, formatEventDate, cateringCode, canApprove, requestSummary } from "@/lib/catering";
import { loadRequestByToken, requestTotals, ensureOrderForRequest } from "@/lib/catering-data";
import { sendCateringRequestOwner, sendCateringRequestReceived } from "@/lib/email";

const RequestInput = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, "Your name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(120).optional().default(""),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  eventTime: z.string().trim().max(40).optional().default(""),
  headcount: z.coerce.number().int().min(0).max(5000).optional(),
  fulfillment: z.enum(["delivery", "pickup"]),
  address: z.string().trim().max(240).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  items: z.array(z.object({ mealId: z.string().min(1), qty: z.number().int().min(0).max(5000) })).max(200),
});
export type CateringRequestInputT = z.infer<typeof RequestInput>;

export type CateringSubmitResult = { ok: true; token: string } | { ok: false; message: string; field?: string };

/** Storefront: a customer asks for a catering quote. Nothing is charged here. */
export async function submitCateringRequest(input: CateringRequestInputT): Promise<CateringSubmitResult> {
  const parsed = RequestInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue.message, field: String(issue.path[0] ?? "") };
  }
  const d = parsed.data;
  if (!(await rateLimit("catering-request", await clientIp(), 5, "1 h")).ok) {
    return { ok: false, message: "Too many requests from this connection. Try again in an hour." };
  }
  const business = await getStorefrontBusiness(d.slug);
  const s = business?.settings;
  if (!business || !s || !s.cateringEnabled) return { ok: false, message: "This kitchen isn't taking catering requests right now." };

  const tz = s.timezone || DEFAULT_TIMEZONE;
  if (!eventDateAllowed(d.eventDate, s.cateringLeadDays, tz)) {
    return { ok: false, field: "eventDate", message: `We need at least ${s.cateringLeadDays} day${s.cateringLeadDays === 1 ? "" : "s"}' notice — pick a later date.` };
  }
  const fulfillment = s.fulfillment === "pickup" ? "pickup" : s.fulfillment === "delivery" ? "delivery" : d.fulfillment;
  if (fulfillment === "delivery" && !d.address) return { ok: false, field: "address", message: "Where should we deliver?" };

  // Price the picked meals from the live menu (never trust client prices).
  const wanted = d.items.filter((i) => i.qty > 0);
  const meals = wanted.length
    ? await db.meal.findMany({ where: { businessId: business.id, active: true, id: { in: wanted.map((i) => i.mealId) } }, select: { id: true, name: true, priceCents: true } })
    : [];
  const byId = new Map(meals.map((m) => [m.id, m]));
  const lines = wanted
    .filter((i) => byId.has(i.mealId))
    .map((i) => ({ mealId: i.mealId, name: byId.get(i.mealId)!.name, qty: i.qty, unitPriceCents: byId.get(i.mealId)!.priceCents }));
  const mealCount = lines.reduce((n, l) => n + l.qty, 0);
  if (mealCount < s.cateringMinMeals && d.notes.length < 10) {
    return { ok: false, field: "items", message: `Catering starts at ${s.cateringMinMeals} meals — add more, or describe what you need and we'll quote it.` };
  }

  const existing = await db.customer.findFirst({ where: { businessId: business.id, email: d.email }, select: { id: true } });
  const token = randomBytes(16).toString("hex");
  const req = await db.cateringRequest.create({
    data: {
      businessId: business.id,
      customerId: existing?.id ?? null,
      token,
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      company: d.company || null,
      eventDate: eventDateToInstant(d.eventDate),
      eventTime: d.eventTime || null,
      headcount: d.headcount || null,
      fulfillment,
      address: fulfillment === "delivery" ? d.address || null : null,
      notes: d.notes || null,
      items: lines,
      deliveryFeeCents: fulfillment === "delivery" ? s.deliveryFeeCents : 0,
      taxRateBps: s.taxRateBps,
    },
    select: { id: true },
  });

  // Emails: customer gets a status link; owner gets the request.
  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const code = cateringCode(req.id);
  const eventDateLabel = formatEventDate(eventDateToInstant(d.eventDate), tz);
  const summary = requestSummary({ headcount: d.headcount || null, mealCount });
  const owner = await db.user.findFirst({ where: { businessId: business.id, role: "owner" }, select: { email: true } });
  await Promise.all([
    sendCateringRequestReceived({
      to: d.email,
      businessName: business.name,
      brandColor: business.brandColor,
      code,
      eventDateLabel,
      firstName: d.name.split(" ")[0],
      statusUrl: `${origin}/store/${d.slug}/catering/${token}`,
      summary,
      leadNote: `Quotes usually go out within a business day. Your event is ${eventDateLabel}.`,
    }),
    owner?.email
      ? sendCateringRequestOwner({
          to: owner.email,
          businessName: business.name,
          brandColor: business.brandColor,
          code,
          eventDateLabel,
          name: d.name,
          email: d.email,
          phone: d.phone || null,
          company: d.company || null,
          summary,
          fulfillment,
          address: fulfillment === "delivery" ? d.address || null : null,
          notes: d.notes || null,
          dashboardUrl: `${origin}/dashboard/catering/${req.id}`,
        })
      : Promise.resolve(),
  ]);

  return { ok: true, token };
}

export type ApproveResult = { ok: true; checkoutUrl?: string; orderId: string } | { ok: false; message: string };

/**
 * Quote page: the customer approves. We create the Order (pending) and hand
 * them to Stripe Checkout for the quoted total; the success page marks both
 * the order and the request paid. Re-callable if they abandon payment.
 */
export async function approveCateringQuote(input: { slug: string; token: string }): Promise<ApproveResult> {
  if (!(await rateLimit("catering-approve", await clientIp(), 10, "10 m")).ok) return { ok: false, message: "Too many attempts. Try again in a few minutes." };
  const business = await getStorefrontBusiness(input.slug);
  if (!business?.settings) return { ok: false, message: "Store unavailable." };
  const r = await loadRequestByToken(business.id, input.token);
  if (!r) return { ok: false, message: "This quote link isn't valid." };
  if (r.status === "paid") return { ok: true, orderId: r.orderId ?? "" };
  if (!canApprove(r.status)) return { ok: false, message: "This quote can't be approved any more — contact the kitchen." };

  const made = await ensureOrderForRequest(r.id, business.id);
  if (!made) return { ok: false, message: "This quote has no items yet — contact the kitchen." };
  if (made.totalCents <= 0) return { ok: false, message: "This quote has no total — contact the kitchen." };

  if (!STRIPE_ENABLED) return { ok: true, orderId: made.orderId };

  const h = await headers();
  const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const s = business.settings;
  const connected = business.stripeChargesEnabled && business.stripeAccountId;
  const { totals } = requestTotals(r);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: r.email,
    client_reference_id: made.orderId,
    metadata: { orderId: made.orderId, cateringRequestId: r.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PLATFORM_CURRENCY,
          unit_amount: made.totalCents,
          product_data: {
            name: `${business.name} — catering, ${totals.mealCount} meals`,
            description: `Quote #${cateringCode(r.id)} · ${formatEventDate(r.eventDate, s.timezone || DEFAULT_TIMEZONE)}`,
          },
        },
      },
    ],
    ...(connected
      ? {
          payment_intent_data: {
            on_behalf_of: business.stripeAccountId!,
            application_fee_amount: Math.round((made.totalCents * (s.platformFeeBps ?? 0)) / 10000),
            transfer_data: { destination: business.stripeAccountId! },
          },
        }
      : {}),
    success_url: `${origin}/store/${input.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store/${input.slug}/catering/${input.token}?canceled=1`,
  });
  await db.order.update({ where: { id: made.orderId }, data: { stripePaymentIntentId: session.id } });
  return { ok: true, orderId: made.orderId, checkoutUrl: session.url ?? undefined };
}

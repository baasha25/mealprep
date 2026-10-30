"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { stripe, STRIPE_ENABLED, PLATFORM_CURRENCY } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { eventDateAllowed, eventDateToInstant, formatEventDate, cateringCode, canApprove, requestSummary, hasBalanceDue } from "@/lib/catering";
import { paymentPlan, toTerms, balanceDueAt, parseDietary, TERMS_LABEL, daysUntil } from "@/lib/catering-terms";
import { loadRequestByToken, requestTotals, ensureOrderForRequest, moneyState, issueInvoiceForRequest, chooseOptionForRequest } from "@/lib/catering-data";
import { sendCateringRequestOwner, sendCateringRequestReceived, sendCateringInvoice } from "@/lib/email";
import { formatCents } from "@/lib/money";

const RequestInput = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1, "Your name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(120).optional().default(""),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  eventTime: z.string().trim().max(40).optional().default(""),
  deliveryWindow: z.string().trim().max(40).optional().default(""),
  headcount: z.coerce.number().int().min(0).max(5000).optional(),
  fulfillment: z.enum(["delivery", "pickup"]),
  address: z.string().trim().max(240).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  dietary: z.record(z.string(), z.coerce.number().int().min(0).max(5000)).optional().default({}), // keys filtered by parseDietary
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
  // A per-guest package's quantity is the headcount.
  const wanted = d.items.filter((i) => i.qty > 0);
  const meals = wanted.length
    ? await db.meal.findMany({ where: { businessId: business.id, active: true, id: { in: wanted.map((i) => i.mealId) } }, select: { id: true, name: true, priceCents: true, perGuest: true } })
    : [];
  const byId = new Map(meals.map((m) => [m.id, m]));
  const lines = wanted
    .filter((i) => byId.has(i.mealId))
    .map((i) => {
      const m = byId.get(i.mealId)!;
      const qty = m.perGuest && d.headcount ? d.headcount : i.qty;
      return { mealId: i.mealId, name: m.perGuest ? `${m.name} (per guest)` : m.name, qty, unitPriceCents: m.priceCents };
    });
  const mealCount = lines.reduce((n, l) => n + l.qty, 0);
  if (mealCount < s.cateringMinMeals && d.notes.length < 10) {
    return { ok: false, field: "items", message: `Catering starts at ${s.cateringMinMeals} meals — add more, or describe what you need and we'll quote it.` };
  }

  const existing = await db.customer.findFirst({ where: { businessId: business.id, email: d.email }, select: { id: true } });
  const token = randomBytes(16).toString("hex");
  const dietary = parseDietary(d.dietary);
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
      deliveryWindow: d.deliveryWindow || null,
      headcount: d.headcount || null,
      fulfillment,
      address: fulfillment === "delivery" ? d.address || null : null,
      notes: d.notes || null,
      dietary: Object.keys(dietary).length ? dietary : undefined,
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
      businessId: business.id,
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
          businessId: business.id,
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

export type ApproveResult = { ok: true; checkoutUrl?: string; orderId: string; invoiced?: boolean } | { ok: false; message: string };

async function requestOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** One Stripe Checkout for part (or all) of a catering order; the success page records it. */
async function cateringCheckout(input: {
  business: NonNullable<Awaited<ReturnType<typeof getStorefrontBusiness>>>;
  slug: string;
  token: string;
  requestId: string;
  orderId: string;
  email: string;
  amountCents: number;
  label: string;
  description: string;
  kind: "catering_full" | "catering_deposit" | "catering_balance";
}): Promise<string | undefined> {
  const s = input.business.settings!;
  const origin = await requestOrigin();
  const connected = input.business.stripeChargesEnabled && input.business.stripeAccountId;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: input.email,
    client_reference_id: input.orderId,
    metadata: { orderId: input.orderId, cateringRequestId: input.requestId, kind: input.kind },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PLATFORM_CURRENCY,
          unit_amount: input.amountCents,
          product_data: { name: input.label, description: input.description },
        },
      },
    ],
    ...(connected
      ? {
          payment_intent_data: {
            on_behalf_of: input.business.stripeAccountId!,
            application_fee_amount: Math.round((input.amountCents * (s.platformFeeBps ?? 0)) / 10000),
            transfer_data: { destination: input.business.stripeAccountId! },
          },
        }
      : {}),
    success_url: `${origin}/store/${input.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store/${input.slug}/catering/${input.token}?canceled=1`,
  });
  await db.order.update({ where: { id: input.orderId }, data: { stripePaymentIntentId: session.id } });
  return session.url ?? undefined;
}

/**
 * Quote page: the customer approves. Depending on the kitchen's terms this
 * either hands them to Stripe Checkout (full amount or a deposit) or issues an
 * invoice with a due date and confirms the event without a card. Re-callable
 * if they abandon payment.
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

  const s = business.settings;
  const tz = s.timezone || DEFAULT_TIMEZONE;
  const terms = toTerms(r.invoiceTerms ?? s.cateringTerms);
  const plan = paymentPlan(made.totalCents, r.depositBps, terms);

  // Net terms: no card needed. Issue the invoice, confirm production, email it.
  if (plan.mode === "invoice") {
    const inv = await issueInvoiceForRequest(r.id, business.id);
    if (!inv.ok) return { ok: false, message: inv.message };
    const origin = await requestOrigin();
    const dueDays = daysUntil(inv.dueAt);
    await sendCateringInvoice({
      businessId: business.id,
      to: r.email,
      businessName: business.name,
      brandColor: business.brandColor,
      code: cateringCode(r.id),
      eventDateLabel: formatEventDate(r.eventDate, tz),
      firstName: r.name.split(" ")[0],
      invoiceNumber: inv.invoiceNumber,
      dueLabel: dueDays <= 0 ? "due now" : `due ${formatEventDate(inv.dueAt, tz)}`,
      termsLabel: TERMS_LABEL[terms],
      totalCents: made.totalCents,
      outstandingCents: made.totalCents,
      invoiceUrl: `${origin}/store/${input.slug}/catering/${input.token}/invoice`,
      quoteUrl: `${origin}/store/${input.slug}/catering/${input.token}`,
    });
    return { ok: true, orderId: made.orderId, invoiced: true };
  }

  if (!STRIPE_ENABLED) return { ok: true, orderId: made.orderId };
  const { totals } = requestTotals(r);
  const eventLabel = formatEventDate(r.eventDate, tz);
  const checkoutUrl = await cateringCheckout({
    business,
    slug: input.slug,
    token: input.token,
    requestId: r.id,
    orderId: made.orderId,
    email: r.email,
    amountCents: plan.dueNowCents,
    label: plan.mode === "card_deposit" ? `${business.name} — catering deposit (${Math.round((r.depositBps / 10000) * 100)}%)` : `${business.name} — catering, ${totals.mealCount} meals`,
    description: plan.mode === "card_deposit" ? `Quote #${cateringCode(r.id)} · ${eventLabel} · balance ${formatCents(plan.laterCents)} due ${formatEventDate(balanceDueAt(r.eventDate, s.cateringBalanceDays), tz)}` : `Quote #${cateringCode(r.id)} · ${eventLabel}`,
    kind: plan.mode === "card_deposit" ? "catering_deposit" : "catering_full",
  });
  return { ok: true, orderId: made.orderId, checkoutUrl };
}

/** Event page: pay what is still owed (balance after a deposit, or an invoice) by card. */
export async function payCateringBalance(input: { slug: string; token: string }): Promise<ApproveResult> {
  if (!(await rateLimit("catering-approve", await clientIp(), 10, "10 m")).ok) return { ok: false, message: "Too many attempts. Try again in a few minutes." };
  const business = await getStorefrontBusiness(input.slug);
  if (!business?.settings) return { ok: false, message: "Store unavailable." };
  const r = await loadRequestByToken(business.id, input.token);
  if (!r || !r.orderId) return { ok: false, message: "This link isn't valid." };
  if (!hasBalanceDue(r.status)) return { ok: false, message: "Nothing is owed on this event." };
  const money = moneyState(r);
  if (money.outstandingCents <= 0) return { ok: true, orderId: r.orderId };
  if (!STRIPE_ENABLED) return { ok: false, message: "Card payments aren't available — please pay by e-transfer." };
  const tz = business.settings.timezone || DEFAULT_TIMEZONE;
  const checkoutUrl = await cateringCheckout({
    business,
    slug: input.slug,
    token: input.token,
    requestId: r.id,
    orderId: r.orderId,
    email: r.email,
    amountCents: money.outstandingCents,
    label: `${business.name} — ${r.invoiceNumber ? `invoice ${r.invoiceNumber}` : "catering balance"}`,
    description: `Quote #${cateringCode(r.id)} · ${formatEventDate(r.eventDate, tz)}`,
    kind: "catering_balance",
  });
  return { ok: true, orderId: r.orderId, checkoutUrl };
}

/** Proposal with options: the client picks one; its lines become the quote. */
export async function chooseCateringOption(input: { slug: string; token: string; index: number }): Promise<{ ok: true } | { ok: false; message: string }> {
  const business = await getStorefrontBusiness(input.slug);
  if (!business?.settings) return { ok: false, message: "Store unavailable." };
  const r = await loadRequestByToken(business.id, input.token);
  if (!r) return { ok: false, message: "This quote link isn't valid." };
  const idx = Math.floor(Number(input.index));
  if (!Number.isFinite(idx) || idx < 0 || idx > 2) return { ok: false, message: "Pick an option." };
  return chooseOptionForRequest(r.id, business.id, idx);
}

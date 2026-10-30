// Catering — server-side helpers shared by the public quote page and the owner
// dashboard (DB access; the pure math lives in src/lib/catering.ts and
// src/lib/catering-terms.ts).
//
// Money model: the Order carries the quote total; every payment (card deposit,
// card balance, e-transfer, invoice settlement) is a Payment row. The order is
// `confirmed` once money is committed (deposit in, or invoice issued on terms)
// and `paid` when the last cent lands. The request mirrors that as
// deposit_paid / invoiced / paid.

import { db } from "@/lib/db";
import { parseLines, quoteTotals } from "@/lib/catering";
import { paidCents, outstandingCents, invoiceDueAt, formatInvoiceNumber, toTerms, parseOptions, applyOption } from "@/lib/catering-terms";
import { referralCodeFrom } from "@/lib/loyalty";

export type CateringRequestRow = NonNullable<Awaited<ReturnType<typeof loadRequestByToken>>>;

/** Public lookup for the customer's quote page (token is the capability). */
export async function loadRequestByToken(businessId: string, token: string) {
  if (!token || token.length < 16) return null;
  return db.cateringRequest.findFirst({
    where: { businessId, token },
    include: { order: { select: { id: true, status: true, stripePaymentIntentId: true, totalCents: true, payments: { select: { amountCents: true, status: true, refundedAmountCents: true } } } } },
  });
}

/** Totals for a request row, from its stored lines + snapshots. */
export function requestTotals(r: { items: unknown; deliveryFeeCents: number; discountCents: number; taxRateBps: number }) {
  const lines = parseLines(r.items);
  return { lines, totals: quoteTotals(lines, { deliveryFeeCents: r.deliveryFeeCents, discountCents: r.discountCents, taxRateBps: r.taxRateBps }) };
}

/** What has been received and what is still owed on a request's order. */
export function moneyState(r: { items: unknown; deliveryFeeCents: number; discountCents: number; taxRateBps: number; order?: { payments: { amountCents: number; status: string; refundedAmountCents?: number }[] } | null }) {
  const { totals } = requestTotals(r);
  const paid = paidCents(r.order?.payments ?? []);
  return { totalCents: totals.totalCents, paidCents: paid, outstandingCents: outstandingCents(totals.totalCents, paid) };
}

/**
 * Turn an approved quote into the Order the rest of PrepFlow runs on
 * (production, labels, P&L). Idempotent: returns the existing order if the
 * request already has one. Prices are snapshotted from the quote lines.
 */
export async function ensureOrderForRequest(requestId: string, businessId: string): Promise<{ orderId: string; totalCents: number } | null> {
  const r = await db.cateringRequest.findFirst({ where: { id: requestId, businessId } });
  if (!r) return null;
  if (r.orderId) {
    const existing = await db.order.findUnique({ where: { id: r.orderId }, select: { id: true, totalCents: true } });
    if (existing) return { orderId: existing.id, totalCents: existing.totalCents };
  }
  const { lines, totals } = requestTotals(r);
  if (totals.mealCount === 0) return null;

  // The requester becomes (or already is) a customer of this kitchen.
  const customer = await db.customer.upsert({
    where: { businessId_email: { businessId, email: r.email } },
    create: { businessId, name: r.name, email: r.email, phone: r.phone, referralCode: referralCodeFrom(r.name, Date.now() % 100000) },
    update: { phone: r.phone ?? undefined },
  });

  const order = await db.order.create({
    data: {
      businessId,
      customerId: customer.id,
      type: "catering",
      status: "pending",
      fulfillment: r.fulfillment,
      deliveryDate: r.eventDate,
      address: r.address,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      feesCents: totals.deliveryFeeCents,
      totalCents: totals.totalCents, // discount is implicit (subtotal + tax + fees − total)
      items: {
        create: lines.map((l) => ({
          mealId: l.mealId,
          qty: l.qty,
          unitPriceCentsSnapshot: l.unitPriceCents,
          nameSnapshot: l.name,
        })),
      },
    },
    select: { id: true, totalCents: true },
  });
  await db.cateringRequest.update({
    where: { id: r.id },
    data: { orderId: order.id, customerId: customer.id, status: r.status === "requested" || r.status === "quoted" ? "approved" : r.status, approvedAt: r.approvedAt ?? new Date() },
  });
  return { orderId: order.id, totalCents: order.totalCents };
}

export type RecordPaymentResult = { ok: true; orderId: string; settled: boolean; amountCents: number } | { ok: false; message: string };

/**
 * Record money received on a catering order, from any source, and move the
 * order and request to the right state. `amountCents` null = whatever is
 * still outstanding. Idempotent on a Stripe payment intent id.
 */
export async function recordCateringPayment(
  requestId: string,
  businessId: string,
  input: { amountCents: number | null; stripePaymentIntentId?: string | null; stripeChargeId?: string | null },
): Promise<RecordPaymentResult> {
  const made = await ensureOrderForRequest(requestId, businessId);
  if (!made) return { ok: false, message: "Add at least one line to the quote first." };
  const order = await db.order.findFirst({ where: { id: made.orderId, businessId }, select: { id: true, status: true, totalCents: true, payments: { select: { amountCents: true, status: true, refundedAmountCents: true, stripePaymentIntentId: true } } } });
  if (!order) return { ok: false, message: "Order not found." };
  if (input.stripePaymentIntentId && order.payments.some((p) => p.stripePaymentIntentId === input.stripePaymentIntentId)) {
    const paid = paidCents(order.payments);
    return { ok: true, orderId: order.id, settled: outstandingCents(order.totalCents, paid) === 0, amountCents: 0 };
  }
  const already = paidCents(order.payments);
  const owed = outstandingCents(order.totalCents, already);
  const amount = Math.max(0, Math.min(owed, input.amountCents ?? owed));
  if (amount <= 0 && owed > 0) return { ok: false, message: "Enter an amount." };

  const settled = outstandingCents(order.totalCents, already + amount) === 0;
  const now = new Date();
  const r = await db.cateringRequest.findFirst({ where: { id: requestId }, select: { depositPaidAt: true, status: true } });
  await db.$transaction([
    ...(amount > 0
      ? [db.payment.create({ data: { orderId: order.id, amountCents: amount, status: "succeeded", stripePaymentIntentId: input.stripePaymentIntentId ?? null, stripeChargeId: input.stripeChargeId ?? null } })]
      : []),
    db.order.update({ where: { id: order.id }, data: { status: settled ? "paid" : "confirmed", ...(input.stripePaymentIntentId ? { stripePaymentIntentId: input.stripePaymentIntentId } : {}) } }),
    db.cateringRequest.update({
      where: { id: requestId },
      data: settled
        ? { status: "paid", paidAt: now, balancePaidAt: r?.depositPaidAt ? now : null, depositPaidAt: r?.depositPaidAt ?? now }
        : { status: "deposit_paid", depositPaidAt: r?.depositPaidAt ?? now },
    }),
  ]);
  return { ok: true, orderId: order.id, settled, amountCents: amount };
}

/** Mark a catering order paid outside Stripe (e-transfer, cash) — owner action. */
export async function markCateringPaidOffline(requestId: string, businessId: string, method: string, amountCents: number | null = null): Promise<{ ok: true; orderId: string; settled: boolean } | { ok: false; message: string }> {
  const res = await recordCateringPayment(requestId, businessId, { amountCents, stripeChargeId: `offline:${method}` });
  if (!res.ok) return res;
  return { ok: true, orderId: res.orderId, settled: res.settled };
}

/**
 * Approve on terms: create the order, issue the next invoice number, set the
 * due date, and confirm production. Idempotent: a request that already has an
 * invoice keeps it.
 */
export async function issueInvoiceForRequest(requestId: string, businessId: string): Promise<{ ok: true; orderId: string; invoiceNumber: string; dueAt: Date } | { ok: false; message: string }> {
  const made = await ensureOrderForRequest(requestId, businessId);
  if (!made) return { ok: false, message: "This quote has no items yet." };
  const r = await db.cateringRequest.findFirst({ where: { id: requestId, businessId }, select: { invoiceNumber: true, invoiceDueAt: true, invoiceTerms: true, approvedAt: true, status: true } });
  if (!r) return { ok: false, message: "Request not found." };
  if (r.invoiceNumber && r.invoiceDueAt) return { ok: true, orderId: made.orderId, invoiceNumber: r.invoiceNumber, dueAt: r.invoiceDueAt };

  const settings = await db.businessSettings.update({
    where: { businessId },
    data: { invoiceNextNumber: { increment: 1 } },
    select: { invoicePrefix: true, invoiceNextNumber: true, cateringTerms: true },
  });
  const terms = toTerms(r.invoiceTerms ?? settings.cateringTerms);
  const invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, settings.invoiceNextNumber - 1);
  const now = new Date();
  const dueAt = invoiceDueAt(r.approvedAt ?? now, terms);
  await db.$transaction([
    db.cateringRequest.update({ where: { id: requestId }, data: { invoiceNumber, invoiceTerms: terms, invoiceDueAt: dueAt, invoiceSentAt: now, status: r.status === "paid" ? "paid" : "invoiced" } }),
    db.order.updateMany({ where: { id: made.orderId, status: "pending" }, data: { status: "confirmed" } }),
  ]);
  return { ok: true, orderId: made.orderId, invoiceNumber, dueAt };
}

/** The client picks one of the proposal's options; its lines become the quote. */
export async function chooseOptionForRequest(requestId: string, businessId: string, index: number): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await db.cateringRequest.findFirst({ where: { id: requestId, businessId }, select: { options: true, status: true } });
  if (!r) return { ok: false, message: "Request not found." };
  if (r.status !== "quoted") return { ok: false, message: "This quote can no longer be changed." };
  const options = parseOptions(r.options);
  const o = options[index];
  if (!o) return { ok: false, message: "That option isn't available." };
  await db.cateringRequest.update({ where: { id: requestId }, data: { ...applyOption(o), chosenOption: index } });
  return { ok: true };
}

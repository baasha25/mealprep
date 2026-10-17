// Catering — server-side helpers shared by the public quote page and the owner
// dashboard (DB access; the pure math lives in src/lib/catering.ts).

import { db } from "@/lib/db";
import { parseLines, quoteTotals } from "@/lib/catering";
import { referralCodeFrom } from "@/lib/loyalty";

export type CateringRequestRow = NonNullable<Awaited<ReturnType<typeof loadRequestByToken>>>;

/** Public lookup for the customer's quote page (token is the capability). */
export async function loadRequestByToken(businessId: string, token: string) {
  if (!token || token.length < 16) return null;
  return db.cateringRequest.findFirst({
    where: { businessId, token },
    include: { order: { select: { id: true, status: true, stripePaymentIntentId: true } } },
  });
}

/** Totals for a request row, from its stored lines + snapshots. */
export function requestTotals(r: { items: unknown; deliveryFeeCents: number; discountCents: number; taxRateBps: number }) {
  const lines = parseLines(r.items);
  return { lines, totals: quoteTotals(lines, { deliveryFeeCents: r.deliveryFeeCents, discountCents: r.discountCents, taxRateBps: r.taxRateBps }) };
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

/** Mark a catering order paid outside Stripe (e-transfer, cash) — owner action. */
export async function markCateringPaidOffline(requestId: string, businessId: string, method: string): Promise<{ ok: true; orderId: string } | { ok: false; message: string }> {
  const made = await ensureOrderForRequest(requestId, businessId);
  if (!made) return { ok: false, message: "Add at least one line to the quote first." };
  const order = await db.order.findFirst({ where: { id: made.orderId, businessId }, select: { id: true, status: true, totalCents: true } });
  if (!order) return { ok: false, message: "Order not found." };
  if (order.status === "pending") {
    await db.$transaction([
      db.order.update({ where: { id: order.id }, data: { status: "paid" } }),
      db.payment.create({ data: { orderId: order.id, amountCents: order.totalCents, status: "succeeded", stripeChargeId: `offline:${method}` } }),
    ]);
  }
  await db.cateringRequest.update({ where: { id: requestId }, data: { status: "paid", paidAt: new Date() } });
  return { ok: true, orderId: order.id };
}

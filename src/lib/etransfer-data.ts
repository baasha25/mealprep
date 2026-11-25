// Pay by e-transfer — the DB side. Rules live in etransfer.ts (tested).

import { db } from "@/lib/db";
import { pointsForOrder } from "@/lib/loyalty";
import { awaitingEtransferWhere, etransferAmountCents, etransferExpired, ETRANSFER_CHARGE_MARK, HOLD_HOURS_MIN } from "@/lib/etransfer";

/**
 * The owner has the money: record the payment and move the order on (to `paid`
 * unless they jumped it further along). Safe against a double click: only an
 * order still awaiting its e-transfer is touched. The caller sends the receipt.
 */
export async function markEtransferPaid(orderId: string, businessId: string, nextStatus: "paid" | "in_production" | "packed" | "out_for_delivery" | "fulfilled" = "paid"): Promise<{ ok: true; amountCents: number } | { ok: false }> {
  const order = await db.order.findFirst({ where: { id: orderId, businessId, ...awaitingEtransferWhere }, select: { id: true, totalCents: true, giftRedeemedCents: true } });
  if (!order) return { ok: false };
  const flipped = await db.order.updateMany({ where: { id: order.id, businessId, ...awaitingEtransferWhere }, data: { status: nextStatus } });
  if (flipped.count === 0) return { ok: false };
  const amountCents = etransferAmountCents(order);
  if (amountCents > 0) {
    await db.payment.create({ data: { orderId: order.id, amountCents, status: "succeeded", stripeChargeId: ETRANSFER_CHARGE_MARK } });
  }
  return { ok: true, amountCents };
}

/**
 * Release an order nobody paid for: cancel it and take back the loyalty points
 * it earned at checkout (never more than the customer still has).
 */
export async function cancelUnpaidEtransfer(orderId: string, businessId: string): Promise<boolean> {
  const order = await db.order.findFirst({
    where: { id: orderId, businessId, ...awaitingEtransferWhere },
    select: { id: true, customerId: true, subtotalCents: true, business: { select: { settings: { select: { loyaltyEnabled: true, loyaltyPointsPerDollar: true } } } } },
  });
  if (!order) return false;
  const flipped = await db.order.updateMany({ where: { id: order.id, businessId, ...awaitingEtransferWhere }, data: { status: "canceled" } });
  if (flipped.count === 0) return false;
  const st = order.business.settings;
  if (st?.loyaltyEnabled && order.customerId) {
    const earned = pointsForOrder(order.subtotalCents, st.loyaltyPointsPerDollar);
    if (earned > 0) {
      const c = await db.customer.findUnique({ where: { id: order.customerId }, select: { loyaltyPoints: true } });
      const back = Math.min(c?.loyaltyPoints ?? 0, earned);
      if (back > 0) await db.customer.update({ where: { id: order.customerId }, data: { loyaltyPoints: { decrement: back } } });
    }
  }
  return true;
}

/**
 * Cancel e-transfer orders whose hold window has passed, for one kitchen (run
 * when its Orders page opens) or for all (the daily cron). Orders that used a
 * gift card are left for the owner: the card's balance has already been spent
 * and only they can decide what to do about it. Returns the released order ids.
 */
export async function expireEtransferOrders(opts: { businessId?: string; now?: Date } = {}): Promise<string[]> {
  const now = opts.now ?? new Date();
  const candidates = await db.order.findMany({
    where: {
      ...awaitingEtransferWhere,
      ...(opts.businessId ? { businessId: opts.businessId } : {}),
      giftRedeemedCents: 0,
      createdAt: { lte: new Date(now.getTime() - HOLD_HOURS_MIN * 3_600_000) },
    },
    select: { id: true, businessId: true, createdAt: true, business: { select: { isDemo: true, settings: { select: { etransferHoldHours: true } } } } },
    take: 500,
  });
  const released: string[] = [];
  for (const o of candidates) {
    if (!etransferExpired(o.createdAt, o.business.settings?.etransferHoldHours, now)) continue;
    if (!(await cancelUnpaidEtransfer(o.id, o.businessId))) continue;
    released.push(o.id);
    if (!o.business.isDemo) {
      const { sendEtransferExpired } = await import("@/lib/email");
      await sendEtransferExpired(o.id);
    }
  }
  return released;
}

/** How many orders are waiting on an e-transfer, and how much money that is. */
export async function awaitingEtransferSummary(businessId: string): Promise<{ count: number; cents: number }> {
  const rows = await db.order.findMany({ where: { businessId, ...awaitingEtransferWhere }, select: { totalCents: true, giftRedeemedCents: true } });
  return { count: rows.length, cents: rows.reduce((a, r) => a + etransferAmountCents(r), 0) };
}

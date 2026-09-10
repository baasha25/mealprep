// Partner Program commission math + accrual. Commission is earned only when a
// referred kitchen's software invoice is actually PAID — never at signup and
// never during the free trial (a $0 invoice accrues nothing). Accrual is keyed
// by the Stripe invoice id so a webhook retry can't double-pay a partner.

import { db } from "@/lib/db";

/** Commission in cents for a paid base amount at a bps rate. Rounds to nearest cent. */
export function commissionCents(baseAmountCents: number, commissionBps: number): number {
  if (!Number.isFinite(baseAmountCents) || baseAmountCents <= 0) return 0;
  const bps = Math.max(0, Math.min(commissionBps, 10000)); // clamp 0–100%
  return Math.round((baseAmountCents * bps) / 10000);
}

/** "YYYY-MM" for the given date (UTC), used to label the accrual period. */
export function periodMonth(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Accrue a pending commission for a paid kitchen-software invoice, if the
 * kitchen was referred by an active partner. Idempotent (unique sourceInvoiceId)
 * and best-effort: any failure is swallowed so it can never break the webhook.
 * Returns true when a new commission row was created.
 */
export async function accrueCommissionForInvoice(input: {
  businessId: string;
  referredByPartnerId: string | null | undefined;
  invoiceId: string | null | undefined;
  amountPaidCents: number | null | undefined;
  currency?: string | null;
}): Promise<boolean> {
  const { businessId, referredByPartnerId, invoiceId } = input;
  const amount = input.amountPaidCents ?? 0;
  if (!referredByPartnerId || !invoiceId || amount <= 0) return false;

  try {
    const partner = await db.partner.findUnique({
      where: { id: referredByPartnerId },
      select: { id: true, status: true, commissionBps: true },
    });
    if (!partner || partner.status !== "active") return false;

    const amountCents = commissionCents(amount, partner.commissionBps);
    if (amountCents <= 0) return false;

    // Idempotent on the Stripe invoice id: a retry finds the row and no-ops.
    const existing = await db.partnerCommission.findUnique({
      where: { sourceInvoiceId: invoiceId },
      select: { id: true },
    });
    if (existing) return false;

    await db.partnerCommission.create({
      data: {
        partnerId: partner.id,
        businessId,
        amountCents,
        baseAmountCents: amount,
        currency: (input.currency || "cad").toLowerCase(),
        commissionBps: partner.commissionBps,
        sourceInvoiceId: invoiceId,
        periodMonth: periodMonth(),
        status: "pending",
      },
    });
    return true;
  } catch (err) {
    console.error("[partner-commission] accrual failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

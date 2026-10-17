// Partner Program commission math + accrual.
//
// Three ways a partner earns on a referred kitchen, all paid only on money
// PrepFlow has actually received:
//   1. subscription    — a % of every PAID software invoice (first charge + renewals)
//   2. activation_bonus — a one-time amount when the kitchen pays its FIRST invoice
//   3. platform_fee    — a % of the platform fee PrepFlow earned on the kitchen's
//                        sales, accrued monthly by the partner-fees cron
// Nothing accrues at signup or during the free trial ($0 invoices accrue nothing).
// Both recurring rates step up once the partner has `stepUpAtKitchens` referred
// kitchens live and paying. Every accrual is idempotent on `sourceInvoiceId`.

import { db } from "@/lib/db";
import { revenueStatusWhere } from "@/lib/order-status";

export type CommissionKind = "subscription" | "activation_bonus" | "platform_fee";

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
 * The rate that applies right now: the base rate until the partner has
 * `stepUpAt` referred kitchens live, the step-up rate from then on. A step-up
 * rate below the base never lowers the rate.
 */
export function effectiveRateBps(baseBps: number, stepUpBps: number, stepUpAt: number, liveKitchens: number): number {
  if (stepUpAt > 0 && liveKitchens >= stepUpAt) return Math.max(baseBps, stepUpBps);
  return baseBps;
}

/** PrepFlow's platform fee on a kitchen's monthly sales, in cents. */
export function platformFeeCents(gmvCents: number, platformFeeBps: number): number {
  return commissionCents(gmvCents, platformFeeBps);
}

/** The partner's slice of that platform fee. */
export function feeShareCents(gmvCents: number, platformFeeBps: number, shareBps: number): number {
  return commissionCents(platformFeeCents(gmvCents, platformFeeBps), shareBps);
}

/** First and last instant (UTC) of a "YYYY-MM" month. */
export function monthBounds(label: string): { start: Date; end: Date } {
  const [y, m] = label.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** The "YYYY-MM" of the month before `d` — what the monthly fee cron settles. */
export function previousMonth(d: Date = new Date()): string {
  return periodMonth(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
}

type PartnerRates = {
  id: string;
  status: string;
  commissionBps: number;
  feeShareBps: number;
  activationBonusCents: number;
  stepUpBps: number;
  stepUpAtKitchens: number;
};

/** Referred kitchens currently paying — drives the step-up. */
async function liveReferredKitchens(partnerId: string): Promise<number> {
  return db.business.count({ where: { referredByPartnerId: partnerId, billingStatus: "active", isDemo: false } });
}

/**
 * Accrue a pending commission for a paid kitchen-software invoice, if the
 * kitchen was referred by an active partner. Also drops the one-time activation
 * bonus on the kitchen's FIRST paid invoice. Idempotent and best-effort: any
 * failure is swallowed so it can never break the webhook.
 * Returns true when a new subscription commission row was created.
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
    const partner: PartnerRates | null = await db.partner.findUnique({
      where: { id: referredByPartnerId },
      select: { id: true, status: true, commissionBps: true, feeShareBps: true, activationBonusCents: true, stepUpBps: true, stepUpAtKitchens: true },
    });
    if (!partner || partner.status !== "active") return false;

    // Idempotent on the Stripe invoice id: a retry finds the row and no-ops.
    const existing = await db.partnerCommission.findUnique({ where: { sourceInvoiceId: invoiceId }, select: { id: true } });
    if (existing) return false;

    const live = await liveReferredKitchens(partner.id);
    const rateBps = effectiveRateBps(partner.commissionBps, partner.stepUpBps, partner.stepUpAtKitchens, live);
    const amountCents = commissionCents(amount, rateBps);
    const currency = (input.currency || "cad").toLowerCase();
    const month = periodMonth();

    // First paid invoice for this kitchen? Then the activation bonus is due too.
    const priorSub = await db.partnerCommission.findFirst({ where: { businessId, kind: "subscription" }, select: { id: true } });

    await db.$transaction(async (tx) => {
      if (amountCents > 0) {
        await tx.partnerCommission.create({
          data: { partnerId: partner.id, businessId, amountCents, baseAmountCents: amount, currency, commissionBps: rateBps, kind: "subscription", sourceInvoiceId: invoiceId, periodMonth: month, status: "pending" },
        });
      }
      if (!priorSub && partner.activationBonusCents > 0) {
        const bonusKey = `bonus:${businessId}`;
        const dup = await tx.partnerCommission.findUnique({ where: { sourceInvoiceId: bonusKey }, select: { id: true } });
        if (!dup) {
          await tx.partnerCommission.create({
            data: { partnerId: partner.id, businessId, amountCents: partner.activationBonusCents, baseAmountCents: amount, currency, commissionBps: 0, kind: "activation_bonus", sourceInvoiceId: bonusKey, periodMonth: month, status: "pending" },
          });
        }
      }
    });
    return amountCents > 0;
  } catch (err) {
    console.error("[partner-commission] accrual failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export type FeeShareSummary = { month: string; partners: number; kitchens: number; created: number; skipped: number; totalCents: number };

/**
 * Monthly accrual of each partner's share of the platform fee PrepFlow earned on
 * their referred kitchens' sales. Run after the month closes (cron, 2nd of the
 * month). Counts only kitchens that are paying (or comped by us); never trials.
 * Idempotent per kitchen per month via sourceInvoiceId "fee:<biz>:<YYYY-MM>".
 */
export async function accruePlatformFeeShares(month: string = previousMonth()): Promise<FeeShareSummary> {
  const { start, end } = monthBounds(month);
  const summary: FeeShareSummary = { month, partners: 0, kitchens: 0, created: 0, skipped: 0, totalCents: 0 };

  const partners = await db.partner.findMany({
    where: { status: "active" },
    select: { id: true, status: true, commissionBps: true, feeShareBps: true, activationBonusCents: true, stepUpBps: true, stepUpAtKitchens: true },
  });

  for (const partner of partners) {
    const kitchens = await db.business.findMany({
      where: { referredByPartnerId: partner.id, isDemo: false, OR: [{ billingStatus: "active" }, { billingComped: true }] },
      select: { id: true, settings: { select: { platformFeeBps: true } } },
    });
    if (kitchens.length === 0) continue;
    summary.partners += 1;
    const live = await liveReferredKitchens(partner.id);
    const shareBps = effectiveRateBps(partner.feeShareBps, partner.stepUpBps, partner.stepUpAtKitchens, live);

    for (const k of kitchens) {
      summary.kitchens += 1;
      const key = `fee:${k.id}:${month}`;
      const dup = await db.partnerCommission.findUnique({ where: { sourceInvoiceId: key }, select: { id: true } });
      if (dup) { summary.skipped += 1; continue; }
      const gmv = await db.order.aggregate({
        where: { businessId: k.id, ...revenueStatusWhere, createdAt: { gte: start, lt: end } },
        _sum: { totalCents: true },
      });
      const gmvCents = gmv._sum.totalCents ?? 0;
      const feeBps = k.settings?.platformFeeBps ?? 150;
      const base = platformFeeCents(gmvCents, feeBps);
      const amountCents = commissionCents(base, shareBps);
      if (amountCents <= 0) { summary.skipped += 1; continue; }
      await db.partnerCommission.create({
        data: { partnerId: partner.id, businessId: k.id, amountCents, baseAmountCents: base, currency: "cad", commissionBps: shareBps, kind: "platform_fee", sourceInvoiceId: key, periodMonth: month, status: "pending" },
      });
      summary.created += 1;
      summary.totalCents += amountCents;
    }
  }
  return summary;
}

export const KIND_LABEL: Record<string, string> = {
  subscription: "Subscription share",
  activation_bonus: "Activation bonus",
  platform_fee: "Platform-fee share",
};

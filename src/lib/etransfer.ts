// Pay by Interac e-Transfer — pure rules (tested).
//
// A kitchen can let customers pay a one-time storefront order by e-transfer
// instead of a card. Interac gives software no way to see the money arrive, so
// the order waits in `pending` with paymentMethod "etransfer" until the owner
// marks it received; it is not cooked, routed or labelled before that. An order
// nobody pays cancels itself after the kitchen's hold window.

export const ETRANSFER = "etransfer";
/** Payment.stripeChargeId marker for money taken outside Stripe (same convention as catering). */
export const ETRANSFER_CHARGE_MARK = "offline:e-transfer";

export const HOLD_HOURS_MIN = 2;
export const HOLD_HOURS_MAX = 168;
export const HOLD_HOURS_DEFAULT = 48;

type SettingsLike = { etransferEnabled?: boolean | null; etransferEmail?: string | null; etransferNote?: string | null; etransferHoldHours?: number | null } | null | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEtransferEmail(v: string | null | undefined): boolean {
  return Boolean(v && EMAIL_RE.test(v.trim()));
}

export function clampHoldHours(n: number | null | undefined): number {
  if (!Number.isFinite(n as number)) return HOLD_HOURS_DEFAULT;
  return Math.min(HOLD_HOURS_MAX, Math.max(HOLD_HOURS_MIN, Math.round(n as number)));
}

/** What the storefront needs to offer e-transfer, or null when the kitchen hasn't set it up. */
export function etransferOffer(s: SettingsLike): { email: string; note: string | null; holdHours: number } | null {
  if (!s?.etransferEnabled || !isEtransferEmail(s.etransferEmail)) return null;
  return { email: s.etransferEmail!.trim(), note: s.etransferNote?.trim() || null, holdHours: clampHoldHours(s.etransferHoldHours) };
}

type OrderLike = { status: string; paymentMethod?: string | null };

/** Placed with "pay by e-transfer" and the owner hasn't confirmed the money yet. */
export function isAwaitingEtransfer(o: OrderLike): boolean {
  return o.paymentMethod === ETRANSFER && o.status === "pending";
}

/** Prisma `where` fragment for the same thing. */
export const awaitingEtransferWhere = { paymentMethod: ETRANSFER, status: "pending" as const };

/** What the customer still has to send: the total less any gift card already applied. */
export function etransferAmountCents(o: { totalCents: number; giftRedeemedCents?: number | null }): number {
  return Math.max(0, o.totalCents - (o.giftRedeemedCents ?? 0));
}

/** The reference the customer quotes in the e-transfer message, e.g. "A1B2C3". */
export function etransferReference(orderId: string): string {
  return orderId.slice(-6).toUpperCase();
}

export function etransferDeadline(createdAt: Date, holdHours: number | null | undefined): Date {
  return new Date(createdAt.getTime() + clampHoldHours(holdHours) * 3_600_000);
}

export function etransferExpired(createdAt: Date, holdHours: number | null | undefined, now: Date): boolean {
  return now.getTime() >= etransferDeadline(createdAt, holdHours).getTime();
}

/**
 * Statuses that mean "the kitchen has the money" when an owner moves an
 * awaiting-e-transfer order forward by hand from the status menu.
 */
export const MONEY_IN_STATUSES = ["paid", "in_production", "packed", "out_for_delivery", "fulfilled"] as const;
export function impliesMoneyIn(status: string): boolean {
  return (MONEY_IN_STATUSES as readonly string[]).includes(status);
}

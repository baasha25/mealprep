// Owner-side refunds for subscription payments — pure helpers (tested).
//
// Subscription charges run through PrepFlow's platform Stripe account and are
// passed to the kitchen's connected account (destination charges). Refunding
// one correctly means three things at once: refund the card, REVERSE the
// transfer so the kitchen's balance gives the money back, and refund the
// platform fee. A charge without transfer_data (demo / unconnected kitchen) is
// a plain refund.

export type ChargeLike = {
  id: string;
  amount: number;
  amount_refunded: number;
  status: string;
  created: number; // unix seconds
  refunded: boolean;
  transfer_data?: { destination?: string | null } | null;
  invoice?: string | { id: string } | null;
};

/** Latest succeeded charge with money left to refund (newest first), or null. */
export function pickRefundableCharge<C extends ChargeLike>(charges: readonly C[]): C | null {
  const ok = charges.filter((c) => c.status === "succeeded" && c.amount_refunded < c.amount);
  ok.sort((a, b) => b.created - a.created);
  return ok[0] ?? null;
}

/** Stripe refund params for a charge: full remaining amount, Connect-aware. */
export function refundParamsFor(charge: ChargeLike): { charge: string; amount: number; reverse_transfer?: boolean; refund_application_fee?: boolean } {
  const amount = Math.max(0, charge.amount - charge.amount_refunded);
  const connected = Boolean(charge.transfer_data?.destination);
  return connected ? { charge: charge.id, amount, reverse_transfer: true, refund_application_fee: true } : { charge: charge.id, amount };
}

export function invoiceIdOf(charge: ChargeLike): string | null {
  const inv = charge.invoice;
  return typeof inv === "string" ? inv : inv?.id ?? null;
}

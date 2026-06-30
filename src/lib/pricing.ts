// Authoritative order pricing — pure integer-cents math (no floats for money).
// Used by the storefront for live display AND recomputed server-side at checkout.
// Order of operations mirrors the demo:
//   subtotal -> subscription discount -> coupon -> tax -> + fees = total.

export type CartLine = { priceCents: number; qty: number };

export type PricingSettings = {
  subDiscountBps: number;
  taxRateBps: number;
  deliveryFeeCents: number;
  processingFeeCents: number;
  minOrderCents: number;
};

export type AppliedCoupon =
  | { type: "percent"; value: number } // value = whole percent (e.g. 10)
  | { type: "flat"; value: number }; // value = cents

export type OrderTotals = {
  itemCount: number;
  subtotalCents: number;
  subDiscountCents: number;
  couponCents: number;
  taxCents: number;
  deliveryFeeCents: number;
  processingFeeCents: number;
  feesCents: number;
  totalCents: number;
  belowMinimum: boolean;
};

const applyBps = (cents: number, bps: number) =>
  Math.round((cents * bps) / 10000);

export function computeOrder(opts: {
  lines: CartLine[];
  settings: PricingSettings;
  subscribe: boolean;
  coupon?: AppliedCoupon | null;
}): OrderTotals {
  const { lines, settings, subscribe, coupon } = opts;

  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const subtotalCents = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);

  const subDiscountCents = subscribe
    ? applyBps(subtotalCents, settings.subDiscountBps)
    : 0;

  const afterSub = subtotalCents - subDiscountCents;

  let couponCents = 0;
  if (coupon && afterSub > 0) {
    couponCents =
      coupon.type === "percent"
        ? Math.round((afterSub * coupon.value) / 100)
        : Math.min(coupon.value, afterSub);
  }

  const afterDiscounts = Math.max(0, afterSub - couponCents);
  const taxCents = applyBps(afterDiscounts, settings.taxRateBps);

  // Fees only apply to a non-empty order.
  const deliveryFeeCents = itemCount > 0 ? settings.deliveryFeeCents : 0;
  const processingFeeCents = itemCount > 0 ? settings.processingFeeCents : 0;
  const feesCents = deliveryFeeCents + processingFeeCents;

  const totalCents = itemCount > 0 ? afterDiscounts + taxCents + feesCents : 0;
  const belowMinimum = itemCount > 0 && subtotalCents < settings.minOrderCents;

  return {
    itemCount,
    subtotalCents,
    subDiscountCents,
    couponCents,
    taxCents,
    deliveryFeeCents,
    processingFeeCents,
    feesCents,
    totalCents,
    belowMinimum,
  };
}

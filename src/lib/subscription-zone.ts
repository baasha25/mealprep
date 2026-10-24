// Keep a subscription's zone in step with where the subscriber lives.
//
// The zone is set from the postal code typed at plan sign-up. When the
// subscriber later saves an address in a different zone, the subscription's
// zone, delivery days and weekly fee move with them, and the fee line on the
// Stripe subscription is re-priced (no proration — the new fee starts with the
// next charge). Best-effort on the Stripe side: a failure is logged, never
// surfaced to the customer, and the next save retries it.

import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED, PLATFORM_CURRENCY } from "@/lib/stripe";
import { zoneForPostal, zoneDays, zoneFeeCents, kitchenDaysWithZones, normalizePostal, type ZoneLike } from "@/lib/zones";
import { enabledDeliveryDays, sanitizePreferredDays } from "@/lib/delivery-days";
import { nextCutoffAt, upcomingDeliveries, DEFAULT_TIMEZONE } from "@/lib/cutoff";

export type RezoneResult = { changed: boolean; zone: string | null; feeCents: number };

/** Re-place every non-canceled subscription of a customer from a postal code. */
export async function rezoneCustomerSubscriptions(customerId: string, postalCode: string | null | undefined): Promise<RezoneResult[]> {
  const subs = await db.subscription.findMany({
    where: { customerId, status: { not: "canceled" } },
    select: { id: true, businessId: true, zone: true, deliveryFeeCents: true, preferredDeliveryDays: true, nextDeliveryDate: true, frequency: true, stripeSubscriptionId: true, stripeFeeItemId: true },
  });
  const out: RezoneResult[] = [];
  for (const sub of subs) out.push(await rezoneSubscription(sub, postalCode));
  return out;
}

async function rezoneSubscription(
  sub: { id: string; businessId: string; zone: string | null; deliveryFeeCents: number; preferredDeliveryDays: string[]; nextDeliveryDate: Date | null; frequency: string; stripeSubscriptionId: string | null; stripeFeeItemId: string | null },
  postalCode: string | null | undefined,
): Promise<RezoneResult> {
  const [settings, zoneRows] = await Promise.all([
    db.businessSettings.findUnique({ where: { businessId: sub.businessId }, select: { timezone: true, cutoff: true, deliveryDays: true, deliveryFeeCents: true } }),
    db.deliveryZone.findMany({ where: { businessId: sub.businessId, active: true } }),
  ]);
  const zones: ZoneLike[] = zoneRows.map((z) => ({ ...z, deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean> }));
  if (!zones.length) return { changed: false, zone: sub.zone, feeCents: sub.deliveryFeeCents };
  const zone = zoneForPostal(postalCode, zones);
  if (!zone) return { changed: false, zone: sub.zone, feeCents: sub.deliveryFeeCents }; // outside every zone: the address save already refused
  const feeCents = zoneFeeCents(zone, settings?.deliveryFeeCents ?? 0);
  const normalized = normalizePostal(postalCode);
  if (zone.name === sub.zone && feeCents === sub.deliveryFeeCents) {
    await db.subscription.update({ where: { id: sub.id }, data: { postalCode: normalized } });
    return { changed: false, zone: zone.name, feeCents };
  }

  // Days: keep what still fits the new zone, else the zone's soonest day; realign
  // the next delivery after the next cut-off so the first drop lands on a real day.
  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  const kitchenDayMap = kitchenDaysWithZones((settings?.deliveryDays ?? {}) as Record<string, boolean>, zones);
  const enabled = enabledDeliveryDays(zoneDays(zone, kitchenDayMap));
  const kept = sanitizePreferredDays(sub.preferredDeliveryDays, enabled);
  const days = kept.length ? kept : enabled.slice(0, 1);
  const anchor = (settings ? nextCutoffAt(settings.cutoff, tz) : null) ?? new Date();
  const soonest = upcomingDeliveries(days, anchor, tz, 1, sub.frequency === "biweekly" ? "biweekly" : "weekly")[0] ?? sub.nextDeliveryDate;

  let stripeFeeItemId = sub.stripeFeeItemId;
  if (STRIPE_ENABLED && sub.stripeSubscriptionId) {
    stripeFeeItemId = await setStripeFee({
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripeFeeItemId: sub.stripeFeeItemId,
      feeCents,
      zoneName: zone.name,
      intervalCount: sub.frequency === "biweekly" ? 2 : 1,
    });
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: { zone: zone.name, postalCode: normalized, deliveryFeeCents: feeCents, preferredDeliveryDays: days, nextDeliveryDate: soonest, stripeFeeItemId },
  });
  return { changed: true, zone: zone.name, feeCents };
}

/**
 * The Stripe product a zone's fee line is priced against. Checkout's inline
 * product_data creates a one-off product that Stripe marks inactive after the
 * session, so it can't be re-priced; we keep one active, reusable product per
 * zone name instead (found by metadata, created on first use).
 */
async function feeProductFor(zoneName: string): Promise<string> {
  const q = `active:'true' AND metadata['kind']:'delivery_fee' AND metadata['zone']:'${zoneName.replace(/'/g, "\\'")}'`;
  const found = await stripe.products.search({ query: q, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const created = await stripe.products.create({ name: `Delivery — ${zoneName}`, metadata: { kind: "delivery_fee", zone: zoneName } });
  return created.id;
}

/** Update (or add) the delivery-fee line on a Stripe subscription. Returns the item id, or the old one on failure. */
async function setStripeFee(opts: { stripeSubscriptionId: string; stripeFeeItemId: string | null; feeCents: number; zoneName: string; intervalCount: 1 | 2 }): Promise<string | null> {
  const unit = Math.max(0, opts.feeCents) * opts.intervalCount;
  try {
    const product = await feeProductFor(opts.zoneName);
    const price_data = { currency: PLATFORM_CURRENCY, product, unit_amount: unit, recurring: { interval: "week" as const, interval_count: opts.intervalCount } };
    if (opts.stripeFeeItemId) {
      await stripe.subscriptionItems.update(opts.stripeFeeItemId, { price_data, proration_behavior: "none" });
      return opts.stripeFeeItemId;
    }
    // No fee line yet (subscribed before zones existed): add one.
    const created = await stripe.subscriptionItems.create({ subscription: opts.stripeSubscriptionId, quantity: 1, price_data, proration_behavior: "none" });
    return created.id;
  } catch (err) {
    console.error("[subscription-zone] Stripe fee update failed:", err);
    return opts.stripeFeeItemId;
  }
}

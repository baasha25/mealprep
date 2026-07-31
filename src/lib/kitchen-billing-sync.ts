// Server-side state transitions for kitchen software billing. Shared by the
// Stripe webhook (authoritative) and the /dashboard/billing success redirect
// (fast-path so the UI updates immediately). All writes are idempotent.

import { db } from "@/lib/db";
import { TIERS, type TierKey } from "@/lib/tiers";
import type { BillingStatus } from "@/lib/kitchen-billing";

/** Set a kitchen's tier and re-sync its per-transaction platform fee. */
async function applyTier(businessId: string, tier: TierKey) {
  await db.$transaction([
    db.business.update({ where: { id: businessId }, data: { tier } }),
    db.businessSettings.updateMany({
      where: { businessId },
      data: { platformFeeBps: TIERS[tier].platformFeeBps },
    }),
  ]);
}

/** A kitchen just subscribed (or resubscribed) — mark active, store the sub, set tier. */
export async function activateKitchenSubscription(opts: {
  businessId: string;
  subscriptionId: string;
  tier: TierKey;
}): Promise<void> {
  await db.business.update({
    where: { id: opts.businessId },
    data: { billingSubscriptionId: opts.subscriptionId, billingStatus: "active" },
  });
  await applyTier(opts.businessId, opts.tier);
}

/** Update billing status for the kitchen owning this subscription id. */
export async function setKitchenBillingStatus(
  subscriptionId: string,
  status: BillingStatus,
  tier?: TierKey | null,
): Promise<{ businessId: string } | null> {
  const biz = await db.business.findFirst({
    where: { billingSubscriptionId: subscriptionId },
    select: { id: true },
  });
  if (!biz) return null;
  await db.business.update({ where: { id: biz.id }, data: { billingStatus: status } });
  if (tier) await applyTier(biz.id, tier);
  return { businessId: biz.id };
}

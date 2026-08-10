// Single source of truth for PrepFlow's platform subscription tiers (the plan a
// KITCHEN is on — not the meal plans a kitchen sells to diners). Prices are
// integer cents; the platform fee is basis points. Keep in sync with the
// marketing landing page and the sales pricing doc.

export type TierKey = "starter" | "growth" | "pro";

export type Tier = {
  key: TierKey;
  name: string;
  priceCents: number; // monthly software fee
  orderLimit: number | null; // orders/mo included; null = unlimited
  platformFeeBps: number; // per-transaction platform fee
  blurb: string;
};

export const TIERS: Record<TierKey, Tier> = {
  starter: { key: "starter", name: "Starter", priceCents: 7900, orderLimit: 150, platformFeeBps: 150, blurb: "New & small kitchens" },
  growth: { key: "growth", name: "Growth", priceCents: 19900, orderLimit: null, platformFeeBps: 125, blurb: "Scaling kitchens" },
  pro: { key: "pro", name: "Pro", priceCents: 34900, orderLimit: null, platformFeeBps: 100, blurb: "High-volume / multi-location" },
};

export const TIER_KEYS: TierKey[] = ["starter", "growth", "pro"];

export function isTierKey(v: unknown): v is TierKey {
  return v === "starter" || v === "growth" || v === "pro";
}

/**
 * The tier a kitchen effectively has RIGHT NOW. During the free trial every
 * kitchen gets full Pro-level access (unlimited orders, all features) regardless
 * of the plan they picked; once the trial ends they fall back to their real tier.
 * Note: this governs features/limits, NOT the per-transaction platform fee, which
 * always follows the kitchen's actual `tier`.
 */
export function effectiveTier(b: { tier: TierKey; trialEndsAt: Date | null }): TierKey {
  // Local import avoided — trial math is tiny and dependency-free.
  const active = b.trialEndsAt != null && b.trialEndsAt.getTime() > Date.now();
  return active ? "pro" : b.tier;
}

// Human label for the fee, e.g. "1.5%".
export function feePctLabel(key: TierKey): string {
  return `${TIERS[key].platformFeeBps / 100}%`;
}

// Kitchen software billing (Option B): the kitchen pays PrepFlow the monthly
// tier fee on PrepFlow's OWN Stripe account. Entirely separate from the Connect
// flow (diners → kitchens). Pure config/status helpers here; the Stripe calls
// live in the billing actions. Everything runs in Stripe TEST mode until live
// keys + live price ids are set.

import type { TierKey } from "@/lib/tiers";
import { trialStatus } from "@/lib/trial";

// Computed locally (not imported from stripe.ts) so this stays a pure, testable
// module — importing the Stripe client would instantiate it and throw with no key.
const STRIPE_ENABLED = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_");

const PRICE_IDS: Record<TierKey, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro: process.env.STRIPE_PRICE_PRO,
};

/** True once the platform prices are configured — kitchen billing is chargeable. */
export const KITCHEN_BILLING_ENABLED =
  STRIPE_ENABLED && Object.values(PRICE_IDS).every((p) => typeof p === "string" && p.length > 0);

export function tierPriceId(tier: TierKey): string | undefined {
  return PRICE_IDS[tier];
}

/** Reverse-lookup a tier from a Stripe price id (webhook: subscription → tier). */
export function tierFromPriceId(priceId: string | null | undefined): TierKey | null {
  if (!priceId) return null;
  const entry = (Object.entries(PRICE_IDS) as [TierKey, string | undefined][]).find(([, id]) => id === priceId);
  return entry ? entry[0] : null;
}

export type BillingStatus = "none" | "active" | "past_due" | "canceled";

export type BusinessBillingShape = {
  trialEndsAt: Date | null;
  billingStatus: BillingStatus;
  billingComped: boolean;
  billingSubscriptionId: string | null;
};

export type AccessState = "comped" | "trialing" | "subscribed" | "past_due" | "locked";

export type KitchenAccess = {
  /** Owner dashboard is soft-locked (read-only) — trial ended and not paying. */
  locked: boolean;
  state: AccessState;
  /** True if a paid subscription is (or was recently) in force. */
  subscribed: boolean;
};

/**
 * Whether a kitchen has full access. A kitchen keeps access while: comped,
 * inside its trial, actively subscribed, or in a past_due grace window (Stripe
 * is retrying the card). It's locked only once the trial has ended AND there's
 * no active/past_due subscription. A locked kitchen's STOREFRONT stays live —
 * only the owner dashboard is gated (see the layout).
 */
export function kitchenAccess(b: BusinessBillingShape, now: Date = new Date()): KitchenAccess {
  if (b.billingComped) return { locked: false, state: "comped", subscribed: false };
  if (b.billingStatus === "active") return { locked: false, state: "subscribed", subscribed: true };
  if (b.billingStatus === "past_due") return { locked: false, state: "past_due", subscribed: true };
  if (trialStatus(b.trialEndsAt, now).active) return { locked: false, state: "trialing", subscribed: false };
  return { locked: true, state: "locked", subscribed: false };
}

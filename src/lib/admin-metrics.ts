// Pure helpers for the operator (super-admin) panel — no DB, unit-testable.
// Everything that renders in /admin is derived here from plain numbers so the
// page stays a thin query + layout layer. Only platform super-admins (see
// src/lib/admin.ts) ever reach the pages that use this.

import { TIERS, type TierKey } from "@/lib/tiers";
import { kitchenAccess, type BusinessBillingShape, type AccessState } from "@/lib/kitchen-billing";
import { trialStatus } from "@/lib/trial";

export const QUIET_DAYS = 14; // no orders for this long → "quiet" (churn-risk) kitchen
export const TRIAL_SOON_DAYS = 7; // trial ends within this window → this week's sales call

/* ─────────────────────────── billing badge ─────────────────────────── */

export type BadgeTone = "pine" | "clay" | "sand" | "muted";

export type BillingBadge = {
  state: AccessState | "canceled";
  label: string; // short, e.g. "Trial · 12d left"
  detail: string; // one line for a tooltip / detail page
  tone: BadgeTone;
  /** Counts toward real (collected) MRR. */
  paying: boolean;
};

/** What the kitchen's software-billing situation is, in one glance. */
export function billingBadge(
  b: BusinessBillingShape & { tier: TierKey; createdAt: Date },
  now: Date = new Date(),
): BillingBadge {
  const price = TIERS[b.tier].priceCents;
  if (b.billingComped) {
    return { state: "comped", label: "Comped", detail: "Free access — never charged (founding customer / demo).", tone: "sand", paying: false };
  }
  const access = kitchenAccess(b, now);
  switch (access.state) {
    case "subscribed":
      return { state: "subscribed", label: "Paying", detail: `Active software subscription — ${TIERS[b.tier].name} at $${price / 100}/mo.`, tone: "pine", paying: true };
    case "past_due":
      return { state: "past_due", label: "Past due", detail: "Card failed; Stripe is retrying. Access continues during the grace window.", tone: "clay", paying: true };
    case "trialing": {
      const t = trialStatus(b.trialEndsAt, now);
      return {
        state: "trialing",
        label: `Trial · ${t.daysLeft}d left`,
        detail: `Free trial ends ${t.endsAt ? fmtDate(t.endsAt) : "—"}. Will need to pick a plan to keep the dashboard.`,
        tone: t.daysLeft <= TRIAL_SOON_DAYS ? "clay" : "muted",
        paying: false,
      };
    }
    default: {
      if (b.billingStatus === "canceled") {
        return { state: "canceled", label: "Canceled", detail: "Subscription canceled; dashboard is read-only.", tone: "muted", paying: false };
      }
      return { state: "locked", label: "Locked", detail: "Trial ended and no subscription — dashboard is read-only until they pick a plan.", tone: "clay", paying: false };
    }
  }
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

/* ─────────────────────────── setup score ─────────────────────────── */

export type SetupFlags = {
  meals: number;
  plans: number;
  stripeConnected: boolean;
  hasLogo: boolean;
  orders: number;
  activeSubs: number;
};

export type SetupItem = { key: keyof SetupFlags; label: string; done: boolean; nudge: string };

export type SetupScore = { done: number; total: number; items: SetupItem[]; complete: boolean };

/** Six things a kitchen must do to be genuinely live. Shows where a new one is stuck. */
export function setupScore(f: SetupFlags): SetupScore {
  const items: SetupItem[] = [
    { key: "meals", label: "Menu added", done: f.meals > 0, nudge: "Add at least one meal (or import the menu for them)." },
    { key: "plans", label: "Meal plan created", done: f.plans > 0, nudge: "Create a weekly plan so subscriptions can sell." },
    { key: "stripeConnected", label: "Stripe connected", done: f.stripeConnected, nudge: "Finish Stripe onboarding — they can't take money until this is done." },
    { key: "hasLogo", label: "Logo uploaded", done: f.hasLogo, nudge: "Upload a logo so the storefront looks like theirs." },
    { key: "orders", label: "First order", done: f.orders > 0, nudge: "No orders yet — check the storefront link is live and shared." },
    { key: "activeSubs", label: "First subscriber", done: f.activeSubs > 0, nudge: "No subscribers yet — subscriptions are the recurring base." },
  ];
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, items, complete: done === items.length };
}

/* ─────────────────────────── momentum & activity ─────────────────────────── */

export type Momentum = { dir: "up" | "down" | "flat" | "new"; label: string; pct: number | null };

/** This month vs last month, as a direction + human label (e.g. "+40%"). */
export function momentum(thisMonth: number, lastMonth: number): Momentum {
  if (lastMonth === 0 && thisMonth === 0) return { dir: "flat", label: "—", pct: null };
  if (lastMonth === 0) return { dir: "new", label: "new", pct: null };
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  if (pct > 5) return { dir: "up", label: `+${pct}%`, pct };
  if (pct < -5) return { dir: "down", label: `${pct}%`, pct };
  return { dir: "flat", label: `${pct >= 0 ? "+" : ""}${pct}%`, pct };
}

/** Whole days since a date (null = never). */
export function daysSince(d: Date | null | undefined, now: Date = new Date()): number | null {
  if (!d) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

/**
 * A kitchen is "quiet" when it has gone QUIET_DAYS without an order — either it
 * used to order and stopped, or it signed up long enough ago that silence means
 * it never launched. Brand-new signups aren't quiet yet.
 */
export function isQuiet(lastOrderAt: Date | null, createdAt: Date, now: Date = new Date()): boolean {
  const since = daysSince(lastOrderAt ?? createdAt, now) ?? 0;
  return since >= QUIET_DAYS;
}

/** PrepFlow's cut of a kitchen's sales at its platform-fee rate (integer cents). */
export function platformFeeCents(gmvCents: number, feeBps: number): number {
  return Math.round((gmvCents * feeBps) / 10_000);
}

/** Human "3d ago" / "today" / "never" for the last-order column. */
export function agoLabel(d: Date | null | undefined, now: Date = new Date()): string {
  const n = daysSince(d, now);
  if (n === null) return "never";
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 30) return `${n}d ago`;
  const m = Math.floor(n / 30);
  return m === 1 ? "1 mo ago" : `${m} mo ago`;
}

/* ─────────────────────────── table filtering ─────────────────────────── */

export const KITCHEN_FILTERS = ["all", "trialing", "paying", "comped", "quiet", "past_due", "locked"] as const;
export type KitchenFilter = (typeof KITCHEN_FILTERS)[number];

export const FILTER_LABEL: Record<KitchenFilter, string> = {
  all: "All",
  trialing: "Trialing",
  paying: "Paying",
  comped: "Comped",
  quiet: "Quiet",
  past_due: "Past due",
  locked: "Locked",
};

export function parseFilter(v: string | undefined | null): KitchenFilter {
  return (KITCHEN_FILTERS as readonly string[]).includes(v ?? "") ? (v as KitchenFilter) : "all";
}

export type FilterableRow = {
  name: string;
  slug: string | null;
  ownerEmail: string;
  badge: BillingBadge;
  quiet: boolean;
};

export function filterKitchens<T extends FilterableRow>(rows: T[], filter: KitchenFilter, q: string): T[] {
  const needle = q.trim().toLowerCase();
  return rows.filter((r) => {
    if (needle) {
      const hay = `${r.name} ${r.slug ?? ""} ${r.ownerEmail}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    switch (filter) {
      case "trialing":
        return r.badge.state === "trialing";
      case "paying":
        return r.badge.state === "subscribed";
      case "comped":
        return r.badge.state === "comped";
      case "quiet":
        return r.quiet;
      case "past_due":
        return r.badge.state === "past_due";
      case "locked":
        return r.badge.state === "locked" || r.badge.state === "canceled";
      default:
        return true;
    }
  });
}

/* ─────────────────────────── daily activity strip ─────────────────────────── */

/** Bucket timestamps into the last `days` calendar days (oldest first). */
export function dailyBuckets(dates: Date[], days: number, now: Date = new Date()): { day: Date; n: number }[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const out = Array.from({ length: days }, (_, i) => ({
    day: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    n: 0,
  }));
  for (const d of dates) {
    const idx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days) out[idx].n += 1;
  }
  return out;
}

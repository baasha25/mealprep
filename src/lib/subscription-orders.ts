// Subscription deliveries → orders.
//
// A subscriber pays for a plan (N meals a week) and picks their meals in their
// account before the cut-off. Until now those picks only fed Kitchen OS; they
// never became an Order, so Orders, Routes, dispatch, packing slips and labels
// couldn't see subscribers at all. This module turns each delivery's picks into
// a paid `subscription` order once its cut-off has passed — exactly one order
// per subscription per delivery date (unique index), so the hourly cron and the
// lazy page-load trigger can both run as often as they like.
//
// This file holds the pure decisions (which dates are due, chef's choice,
// order totals, the weekly charge) — unit-tested and safe to import from client
// components. The DB runner lives in subscription-orders-run.ts (server only).

import { currentCycleDeliveries } from "@/lib/cutoff";
import { cutoffAt, CUTOFF_LEAD_HOURS } from "@/lib/subscriptions";

export type NoPickBehaviour = "skip" | "chef_choice";

/** Settings.subNoPick as stored (free text) → a known behaviour; "skip" when unknown. */
export function parseNoPick(v: unknown): NoPickBehaviour {
  return v === "chef_choice" ? "chef_choice" : "skip";
}

/**
 * The delivery dates of the current cycle whose cut-off has passed and that
 * don't have an order yet. A date more than `graceDays` in the past is left
 * alone (the kitchen has moved on; don't create stale orders on a late run).
 */
export function dueDeliveryDates(opts: {
  now: Date;
  nextDeliveryDate: Date;
  chosenDays: readonly string[];
  tz: string;
  existing: readonly Date[];
  leadHours?: number;
  graceDays?: number;
}): Date[] {
  const lead = opts.leadHours ?? CUTOFF_LEAD_HOURS;
  const grace = (opts.graceDays ?? 2) * 86_400_000;
  const have = new Set(opts.existing.map((d) => d.getTime()));
  return currentCycleDeliveries(opts.chosenDays, opts.nextDeliveryDate, opts.tz)
    .filter((d) => cutoffAt(d, lead).getTime() <= opts.now.getTime())
    .filter((d) => d.getTime() >= opts.now.getTime() - grace)
    .filter((d) => !have.has(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

export type PickItem = { mealId: string; qty: number; optionsSnapshot?: unknown; optionsKey?: string | null };

/**
 * What to make for a subscriber who didn't pick: their most recent picks if
 * they have any, otherwise the kitchen's go-to meals spread across the plan
 * (10 meals over 3 go-tos → 4/3/3). Nothing to go on → nothing.
 */
export function chefChoiceItems(opts: { mealsPerWeek: number; lastItems: readonly PickItem[]; fallbackMealIds: readonly string[] }): PickItem[] {
  // Never bill extras the subscriber didn't ask for: chef's choice is capped at the plan.
  if (opts.lastItems.length) return capItems(opts.lastItems.map((i) => ({ ...i })), Math.max(0, Math.floor(opts.mealsPerWeek)));
  const ids = opts.fallbackMealIds.filter((id, i, a) => a.indexOf(id) === i);
  const n = Math.max(0, Math.floor(opts.mealsPerWeek));
  if (!ids.length || n === 0) return [];
  const out: PickItem[] = ids.slice(0, n).map((mealId) => ({ mealId, qty: 0 }));
  for (let i = 0; i < n; i++) out[i % out.length].qty++;
  return out.filter((i) => i.qty > 0);
}

/** Trim quantities from the end until the list holds at most `max` meals. */
export function capItems(items: PickItem[], max: number): PickItem[] {
  let total = items.reduce((s, i) => s + i.qty, 0);
  const out = items.map((i) => ({ ...i }));
  for (let k = out.length - 1; k >= 0 && total > max; k--) {
    const cut = Math.min(out[k].qty, total - max);
    out[k].qty -= cut;
    total -= cut;
  }
  return out.filter((i) => i.qty > 0);
}

/**
 * Extras: meals picked beyond the plan's weekly count. The plan count spans the
 * whole cycle (a two-day subscriber splits it), so each delivery bills only the
 * extras not already billed by an earlier delivery in the same cycle.
 */
export function extrasForDelivery(opts: { planMeals: number; pickedBefore: number; billedBefore: number; pickedNow: number }): number {
  const plan = Math.max(0, Math.floor(opts.planMeals));
  const over = Math.max(0, opts.pickedBefore + opts.pickedNow - plan);
  return Math.max(0, over - Math.max(0, opts.billedBefore));
}

/**
 * Order totals for a subscription delivery. Snapshot what the plan charges:
 * meals at the plan's per-meal price plus the zone's delivery fee. No tax line
 * — the recurring Stripe charge doesn't collect one, and the order must mirror
 * what was actually charged.
 */
export function subscriptionOrderTotals(opts: { itemCount: number; perMealPriceCents: number; deliveryFeeCents: number }) {
  const subtotalCents = Math.max(0, opts.itemCount) * Math.max(0, opts.perMealPriceCents);
  const feesCents = opts.itemCount > 0 ? Math.max(0, opts.deliveryFeeCents) : 0;
  return { subtotalCents, taxCents: 0, feesCents, totalCents: subtotalCents + feesCents };
}

/** The recurring charge: plan × weeks per charge, plus the zone fee per week. */
export function subscriptionWeeklyCharge(opts: { mealsPerWeek: number; perMealPriceCents: number; deliveryFeeCents: number; intervalCount: 1 | 2 }) {
  const weeklyPlanCents = opts.mealsPerWeek * opts.perMealPriceCents;
  const planCents = weeklyPlanCents * opts.intervalCount;
  const feeCents = Math.max(0, opts.deliveryFeeCents) * opts.intervalCount;
  return { weeklyPlanCents, planCents, feeCents, totalCents: planCents + feeCents };
}

// Subscription cycle + cut-off logic — pure functions so the skip/pause/swap
// state machine is testable in isolation (CLAUDE.md §9: subscription state
// changes must not break). Stripe later handles charging; this owns the rules.

export type Frequency = "weekly" | "biweekly";
export type SubStatus = "active" | "paused" | "canceled";

import { lockAtFor } from "@/lib/cutoff";

// The kitchen's weekly cut-off ("Sat 8:00 PM" in its timezone) is THE rule:
// picks for a delivery lock at the last cut-off before it. Without a rule (or
// an unparseable one) we fall back to this many hours before the delivery.
export const CUTOFF_LEAD_HOURS = 48;

/** The kitchen's cut-off setting, as the lock helpers need it. */
export type CutoffRule = { cutoff: string; timezone?: string | null };

/** When picks for `deliveryDate` lock under the kitchen's rule (48h fallback). */
export function deliveryLockAt(deliveryDate: Date, rule?: CutoffRule | null): Date {
  if (!rule?.cutoff) return cutoffAt(deliveryDate);
  return lockAtFor(deliveryDate, rule.cutoff, rule.timezone || "America/Toronto", CUTOFF_LEAD_HOURS);
}

export function cycleDays(freq: Frequency): number {
  return freq === "weekly" ? 7 : 14;
}

/** Next delivery date one cycle later (does not mutate the input). */
export function advanceDeliveryDate(date: Date, freq: Frequency): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + cycleDays(freq));
  return d;
}

/** The moment edits to a given delivery lock. */
export function cutoffAt(
  nextDeliveryDate: Date,
  leadHours: number = CUTOFF_LEAD_HOURS,
): Date {
  return new Date(nextDeliveryDate.getTime() - leadHours * 3_600_000);
}

export function isBeforeCutoff(
  now: Date,
  nextDeliveryDate: Date | null,
  ruleOrLead: number | CutoffRule | null = CUTOFF_LEAD_HOURS,
): boolean {
  if (!nextDeliveryDate) return false;
  const lock = typeof ruleOrLead === "number" ? cutoffAt(nextDeliveryDate, ruleOrLead) : deliveryLockAt(nextDeliveryDate, ruleOrLead);
  return now.getTime() < lock.getTime();
}

/** Skip/swap require an active subscription and that the cut-off hasn't passed. */
export function canModifyNextDelivery(
  status: SubStatus,
  now: Date,
  nextDeliveryDate: Date | null,
  ruleOrLead: number | CutoffRule | null = CUTOFF_LEAD_HOURS,
): boolean {
  return status === "active" && isBeforeCutoff(now, nextDeliveryDate, ruleOrLead);
}

/** Pause/resume can happen any time the subscription isn't canceled. */
export function canPause(status: SubStatus): boolean {
  return status === "active";
}
export function canResume(status: SubStatus): boolean {
  return status === "paused";
}

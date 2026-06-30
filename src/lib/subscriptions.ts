// Subscription cycle + cut-off logic — pure functions so the skip/pause/swap
// state machine is testable in isolation (CLAUDE.md §9: subscription state
// changes must not break). Stripe later handles charging; this owns the rules.

export type Frequency = "weekly" | "biweekly";
export type SubStatus = "active" | "paused" | "canceled";

// Changes to an upcoming delivery lock this many hours before it ships.
// (The owner's display cut-off string, e.g. "Sat 8:00 PM", is informational;
//  this lead time is the enforced rule.)
export const CUTOFF_LEAD_HOURS = 48;

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
  leadHours: number = CUTOFF_LEAD_HOURS,
): boolean {
  if (!nextDeliveryDate) return false;
  return now.getTime() < cutoffAt(nextDeliveryDate, leadHours).getTime();
}

/** Skip/swap require an active subscription and that the cut-off hasn't passed. */
export function canModifyNextDelivery(
  status: SubStatus,
  now: Date,
  nextDeliveryDate: Date | null,
  leadHours: number = CUTOFF_LEAD_HOURS,
): boolean {
  return status === "active" && isBeforeCutoff(now, nextDeliveryDate, leadHours);
}

/** Pause/resume can happen any time the subscription isn't canceled. */
export function canPause(status: SubStatus): boolean {
  return status === "active";
}
export function canResume(status: SubStatus): boolean {
  return status === "paused";
}

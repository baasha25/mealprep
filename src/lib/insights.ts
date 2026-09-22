// Retention + value insights — pure, testable rules shared by the dashboard
// "needs attention" panel, the Subscriptions at-risk list, the retention cron,
// and the monthly value report. No DB access here.

const DAY = 86_400_000;

export type RiskReason = "paused" | "payment_failed" | "stale_delivery" | "inactive";
export const RISK_LABEL: Record<RiskReason, string> = {
  paused: "Paused",
  payment_failed: "Payment failed",
  stale_delivery: "Delivery not advancing",
  inactive: "No recent order",
};

/**
 * Why a subscriber might be about to churn. Signals, most to least urgent:
 * a failed payment in the last 30 days; an active sub whose next delivery date
 * is stuck in the past (billing/cycle problem); paused; or an active sub with no
 * paid order for longer than its cycle allows (weekly → 21d, biweekly → 35d).
 */
export function subscriberRisk(
  s: {
    status: string;
    frequency: string;
    nextDeliveryDate: Date | null;
    lastPaidOrderAt: Date | null;
    failedPaymentAt: Date | null;
    createdAt: Date;
  },
  now: Date = new Date(),
): RiskReason[] {
  const out: RiskReason[] = [];
  if (s.failedPaymentAt && now.getTime() - s.failedPaymentAt.getTime() <= 30 * DAY) out.push("payment_failed");
  if (s.status === "active" && s.nextDeliveryDate && s.nextDeliveryDate.getTime() < now.getTime() - 2 * DAY) out.push("stale_delivery");
  if (s.status === "paused") out.push("paused");
  if (s.status === "active") {
    const window = (s.frequency === "biweekly" ? 35 : 21) * DAY;
    const anchor = s.lastPaidOrderAt ?? s.createdAt;
    if (now.getTime() - anchor.getTime() > window) out.push("inactive");
  }
  return out;
}

/** Meals that are losing money, and meals under a margin threshold (default 50%). */
export function marginAlerts<T extends { name: string; marginBps: number; losing: boolean; hasRecipe: boolean }>(
  rows: readonly T[],
  thresholdBps = 5000,
): { losing: T[]; thin: T[] } {
  const costed = rows.filter((r) => r.hasRecipe);
  return {
    losing: costed.filter((r) => r.losing),
    thin: costed.filter((r) => !r.losing && r.marginBps < thresholdBps),
  };
}

/**
 * Estimated admin minutes PrepFlow handled — an honest, adjustable heuristic:
 * each order would otherwise be tallied/keyed by hand (minutesPerOrder, kitchen-
 * configurable), plus a small per-meal cost for labels/portioning paperwork.
 */
export function estimateAdminMinutes(input: { orders: number; meals: number; minutesPerOrder: number; minutesPerMeal?: number }): number {
  const perMeal = input.minutesPerMeal ?? 0.5;
  return Math.max(0, Math.round(input.orders * input.minutesPerOrder + input.meals * perMeal));
}

/** Win-back is due: last paid order older than `days`, and not emailed in the cooldown. */
export function winBackDue(lastPaidAt: Date | null, sentAt: Date | null, now: Date, days: number, cooldownDays = 90): boolean {
  if (!lastPaidAt) return false;
  if (now.getTime() - lastPaidAt.getTime() < days * DAY) return false;
  if (sentAt && now.getTime() - sentAt.getTime() < cooldownDays * DAY) return false;
  return true;
}

/** Abandoned-checkout nudge is due: created 2–48h ago and not yet reminded. */
export function abandonedDue(createdAt: Date, remindedAt: Date | null, now: Date, minHours = 2, maxHours = 48): boolean {
  if (remindedAt) return false;
  const age = now.getTime() - createdAt.getTime();
  return age >= minHours * 3_600_000 && age <= maxHours * 3_600_000;
}

/** Calendar-month window from "YYYY-MM" (default: current month). */
export function monthRange(ym: string | undefined, now: Date = new Date()): { start: Date; end: Date; ym: string; label: string; prevYm: string; nextYm: string | null } {
  let y = now.getFullYear(), m = now.getMonth();
  const match = ym && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ? ym : null;
  if (match) { y = Number(match.slice(0, 4)); m = Number(match.slice(5, 7)) - 1; }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = `${start.getFullYear()}-${pad(start.getMonth() + 1)}`;
  const prev = new Date(y, m - 1, 1);
  const next = new Date(y, m + 1, 1);
  const isCurrentOrFuture = next.getTime() > now.getTime();
  return {
    start, end, ym: key,
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    prevYm: `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`,
    nextYm: isCurrentOrFuture ? null : `${next.getFullYear()}-${pad(next.getMonth() + 1)}`,
  };
}

// Free-trial clock. Every kitchen gets TRIAL_DAYS of full access from onboarding.
// Today this is INFORMATIONAL only (a countdown) — there is no lockout at expiry
// until kitchen billing is wired. When billing lands, `ended` gates the paywall.

export const TRIAL_DAYS = 30;

/** Days before expiry to start nudging the owner to pick a plan. */
export const TRIAL_NUDGE_DAYS = 5;

export type TrialStatus = {
  /** Trial exists and hasn't ended yet. */
  active: boolean;
  /** Trial exists and its end date has passed. */
  ended: boolean;
  /** Whole days remaining (0 once ended or if no trial is set). */
  daysLeft: number;
  /** Show the "pick a plan" nudge (active and within the nudge window). */
  nudge: boolean;
  endsAt: Date | null;
};

/** A trial end date TRIAL_DAYS from `from` (default now). */
export function trialEndFrom(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 86_400_000);
}

export function trialStatus(
  trialEndsAt: Date | null | undefined,
  now: Date = new Date(),
): TrialStatus {
  if (!trialEndsAt) return { active: false, ended: false, daysLeft: 0, nudge: false, endsAt: null };
  const ms = trialEndsAt.getTime() - now.getTime();
  const active = ms > 0;
  const daysLeft = active ? Math.ceil(ms / 86_400_000) : 0;
  return {
    active,
    ended: !active,
    daysLeft,
    nudge: active && daysLeft <= TRIAL_NUDGE_DAYS,
    endsAt: trialEndsAt,
  };
}

/**
 * Stripe Checkout only accepts a trial_end at least 48 h out. When the kitchen
 * still has that much trial left, return it (unix seconds) so adding a card
 * early starts billing on the trial's last day, not today. Otherwise null.
 */
export function checkoutTrialEnd(trialEndsAt: Date | null | undefined, now: Date = new Date()): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms < 48 * 3_600_000) return null;
  return Math.floor(trialEndsAt.getTime() / 1000);
}

export type TrialEmailStep = "trial_5d" | "trial_1d" | "trial_ended";

/**
 * Which reminder is due for an unpaid kitchen right now, if any. The cron runs
 * daily and dedupes per step, so each step fires at most once per kitchen:
 *  - trial_5d: 2–5 days left   - trial_1d: last day   - trial_ended: 0–3 days after.
 */
export function trialEmailStep(trialEndsAt: Date | null | undefined, now: Date = new Date()): TrialEmailStep | null {
  if (!trialEndsAt) return null;
  const t = trialStatus(trialEndsAt, now);
  if (t.active) {
    if (t.daysLeft <= 1) return "trial_1d";
    if (t.daysLeft <= TRIAL_NUDGE_DAYS) return "trial_5d";
    return null;
  }
  const daysAgo = (now.getTime() - trialEndsAt.getTime()) / 86_400_000;
  return daysAgo <= 3 ? "trial_ended" : null;
}

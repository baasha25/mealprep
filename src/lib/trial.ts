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

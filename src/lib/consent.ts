// Cookie-consent state, shared by the banner and the analytics components.
// "accepted" — non-essential analytics allowed (opt-in for third-party like PostHog).
// "declined" — no analytics/attribution cookies.
// null — the visitor hasn't chosen yet.

export const CONSENT_COOKIE = "pf_consent";
export type Consent = "accepted" | "declined";

/** Read the current consent choice from document.cookie (client only). */
export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  const v = hit?.split("=")[1];
  return v === "accepted" || v === "declined" ? v : null;
}

/** Persist a consent choice for one year. */
export function writeConsent(choice: Consent): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

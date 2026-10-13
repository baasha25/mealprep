// Single source of truth for "is real auth on, or are we in the local dev stub?"
//
// FAIL CLOSED: the dev stub (every visitor = the first kitchen's owner, and a
// super-admin) is only allowed when it is explicitly requested AND we are not a
// production build. A production deploy that is merely missing CLERK_SECRET_KEY
// must refuse to serve protected routes rather than silently hand out owner access.
//
// Edge-safe (no Node-only imports) — the middleware uses it too.

export const CLERK_ON = Boolean(process.env.CLERK_SECRET_KEY);

export const DEV_STUB =
  !CLERK_ON && process.env.AUTH_DEV_STUB === "1" && process.env.NODE_ENV !== "production";

/** True when neither real auth nor the explicit dev stub is available. */
export const AUTH_MISCONFIGURED = !CLERK_ON && !DEV_STUB;

export const AUTH_MISCONFIGURED_MESSAGE =
  "Authentication is not configured on this deployment (CLERK_SECRET_KEY is missing). Protected areas are disabled.";

export function assertAuthConfigured(): void {
  if (AUTH_MISCONFIGURED) throw new Error(AUTH_MISCONFIGURED_MESSAGE);
}

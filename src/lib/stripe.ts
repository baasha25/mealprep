import Stripe from "stripe";

// Server-side Stripe client. Test-mode keys live in env (never committed).
const key = process.env.STRIPE_SECRET_KEY ?? "";

export const STRIPE_ENABLED = key.startsWith("sk_");

// Construct with a harmless placeholder when Stripe isn't configured, so importing
// this module never throws at build or runtime in environments without Stripe keys
// (staging, local, CI). Real API calls are gated by STRIPE_ENABLED; with the
// placeholder they would fail auth, never silently succeed.
export const stripe = new Stripe(key || "sk_unconfigured", { typescript: true });

// The currency every customer charge settles in (subscriptions + one-time orders).
// Defaults to CAD — the platform's home country — and is overridable per deploy via
// PLATFORM_CURRENCY. When we onboard kitchens in other countries, drive this off the
// kitchen's own account currency instead of a single platform-wide value.
export const PLATFORM_CURRENCY = (process.env.PLATFORM_CURRENCY ?? "cad").toLowerCase();

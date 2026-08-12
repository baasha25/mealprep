import Stripe from "stripe";

// Server-side Stripe client. Test-mode keys live in env (never committed).
const key = process.env.STRIPE_SECRET_KEY ?? "";

export const STRIPE_ENABLED = key.startsWith("sk_");

// Construct with a harmless placeholder when Stripe isn't configured, so importing
// this module never throws at build or runtime in environments without Stripe keys
// (staging, local, CI). Real API calls are gated by STRIPE_ENABLED; with the
// placeholder they would fail auth, never silently succeed.
export const stripe = new Stripe(key || "sk_unconfigured", { typescript: true });

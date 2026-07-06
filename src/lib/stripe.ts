import Stripe from "stripe";

// Server-side Stripe client. Test-mode keys live in env (never committed).
const key = process.env.STRIPE_SECRET_KEY ?? "";

export const STRIPE_ENABLED = key.startsWith("sk_");

export const stripe = new Stripe(key, { typescript: true });

import type { NextConfig } from "next";

// Baseline security headers applied to every response. Deliberately excludes a
// strict Content-Security-Policy for now — a full CSP needs to allowlist Clerk,
// Stripe, PostHog, Sentry, and Google Fonts, and is best rolled out in
// Report-Only mode first so it can't silently break the app. Tracked separately.
const securityHeaders = [
  // Force HTTPS for 2 years incl. subdomains (safe: whole app is HTTPS-only).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Clickjacking protection — the app is never meant to be framed by others.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features the app doesn't use.
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), interest-cohort=()" },
];

// Content Security Policy — REPORT-ONLY for now. Violations are posted to
// /api/csp-report (and Sentry) so we can see what a strict policy would block
// before enforcing it. Allowlist covers everything the app legitimately loads:
// Clerk (auth), Stripe (checkout), PostHog (analytics), Sentry (errors), Crisp
// (chat), Cloudinary (photos), Google Fonts, Cloudflare Turnstile (Clerk bot check).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.prepflow.ca https://*.clerk.accounts.dev https://*.clerk.com https://js.stripe.com https://client.crisp.chat https://us-assets.i.posthog.com https://us.i.posthog.com https://challenges.cloudflare.com",
  "connect-src 'self' https://clerk.prepflow.ca https://*.clerk.accounts.dev https://*.clerk.com https://api.stripe.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://client.crisp.chat wss://client.relay.crisp.chat https://storage.crisp.chat https://api.cloudinary.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://img.clerk.com https://images.unsplash.com https://*.crisp.chat https://image.crisp.chat https://storage.crisp.chat",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat",
  "font-src 'self' data: https://fonts.gstatic.com https://client.crisp.chat",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://challenges.cloudflare.com https://clerk.prepflow.ca https://*.clerk.accounts.dev https://go.crisp.chat",
  "media-src 'self' https://client.crisp.chat",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://clerk.prepflow.ca https://*.clerk.accounts.dev",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    // Invoice-scan uploads (base64 image/PDF) exceed the 1MB server-action default.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders, { key: "Content-Security-Policy-Report-Only", value: csp }] }];
  },
};

export default nextConfig;

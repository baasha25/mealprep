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

const nextConfig: NextConfig = {
  experimental: {
    // Invoice-scan uploads (base64 image/PDF) exceed the 1MB server-action default.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

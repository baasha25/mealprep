import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

// Receives Content-Security-Policy violation reports (the policy is report-only
// today). Logs a compact line (visible in Netlify function logs) and forwards to
// Sentry so we can tighten the allowlist before enforcing. Never throws.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const r = (body?.["csp-report"] ?? body) as Record<string, unknown> | null;
    if (r) {
      const line = `CSP violation: ${r["violated-directive"] ?? r["effective-directive"]} blocked ${r["blocked-uri"]} on ${r["document-uri"]}`;
      console.warn(line);
      Sentry.captureMessage(line, { level: "warning", extra: r });
    }
  } catch {
    /* ignore malformed reports */
  }
  return new NextResponse(null, { status: 204 });
}

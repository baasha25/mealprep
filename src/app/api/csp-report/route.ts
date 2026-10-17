import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// How many distinct (page, directive, origin) rows we keep. Enough to see every
// real integration; small enough that a report flood can't grow the table.
const MAX_DISTINCT_ROWS = 500;

/** Path only — never store query strings (they can carry tokens). */
function pathOf(uri: unknown): string {
  try {
    return new URL(String(uri ?? "")).pathname.slice(0, 200) || "/";
  } catch {
    return String(uri ?? "/").split("?")[0].slice(0, 200) || "/";
  }
}

/** Origin only for URLs; keyword values (inline, eval, data, blob) as-is. */
function originOf(uri: unknown): string {
  const s = String(uri ?? "").trim();
  if (!s) return "(empty)";
  if (/^[a-z]+$/i.test(s)) return s.toLowerCase(); // "inline" | "eval" | "data" | "blob" | "wasm-eval"
  if (/^(data|blob):/i.test(s)) return s.split(":")[0].toLowerCase();
  try {
    return new URL(s).origin.slice(0, 200);
  } catch {
    return s.slice(0, 200);
  }
}

/**
 * Receives Content-Security-Policy violation reports (the policy is report-only
 * today). Each report is folded into one row per (page, directive, blocked origin)
 * with a running count, shown to the operator in /admin so the allowlist can be
 * proven clean before the header is switched to enforcing. Also logged + sent to
 * Sentry. Never throws; always 204.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const r = (body?.["csp-report"] ?? body) as Record<string, unknown> | null;
    if (r && typeof r === "object") {
      const directive = String(r["effective-directive"] ?? r["violated-directive"] ?? "unknown").split(" ")[0].slice(0, 60);
      const documentPath = pathOf(r["document-uri"]);
      const blockedUri = originOf(r["blocked-uri"]);
      const line = `CSP violation: ${directive} blocked ${blockedUri} on ${documentPath}`;
      console.warn(line);
      Sentry.captureMessage(line, { level: "warning", extra: r });

      const existing = await db.cspReport.findUnique({ where: { documentPath_directive_blockedUri: { documentPath, directive, blockedUri } }, select: { id: true } });
      if (existing) {
        await db.cspReport.update({ where: { id: existing.id }, data: { count: { increment: 1 }, lastSeenAt: new Date() } });
      } else if ((await db.cspReport.count()) < MAX_DISTINCT_ROWS) {
        // Keep one raw sample (minus the document URI's query string) for debugging.
        const sample = { ...r, "document-uri": documentPath };
        await db.cspReport.create({ data: { documentPath, directive, blockedUri, sample } });
      }
    }
  } catch {
    /* ignore malformed reports / transient DB errors — reporting must never fail the page */
  }
  return new NextResponse(null, { status: 204 });
}

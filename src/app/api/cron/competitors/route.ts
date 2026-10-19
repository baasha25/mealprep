import { NextRequest, NextResponse } from "next/server";
import { refreshStaleCompetitors } from "@/lib/competitors-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Daily: re-read watched competitors whose last read is 6+ days old (prices
// move), within a time budget, and refresh suggestions. AI reads are slow, so a
// run may not reach everyone; the next day's run picks up the rest.
// Shared-secret guard like the other cron routes.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const all = req.nextUrl.searchParams.get("all") === "1";
  const r = await refreshStaleCompetitors({ budgetMs: 100_000, minAgeDays: all ? 0 : 6 });
  return NextResponse.json({ ok: true, attempted: r.attempted, refreshed: r.ok, failed: r.failed, skipped: r.skipped });
}

export const GET = handle;
export const POST = handle;

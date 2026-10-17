import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshCompetitorData } from "@/lib/competitors-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Weekly: re-read every watched competitor's public menu (prices move) and
// refresh suggestions. Shared-secret guard like the other cron routes.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const comps = await db.competitor.findMany({ where: { status: { not: "unsupported" } }, select: { id: true }, take: 300 });
  let ok = 0, failed = 0;
  for (const c of comps) {
    const r = await refreshCompetitorData(c.id);
    if (r.ok) ok++; else failed++;
  }
  return NextResponse.json({ ok: true, refreshed: ok, failed });
}

export const GET = handle;
export const POST = handle;

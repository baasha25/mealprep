import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check.
 *
 * Plain GET (uptime monitors): answers without touching the database, so it
 * never wakes Neon. The scheduled keep-warm ping also lands here and only keeps
 * the Netlify function warm — the database is allowed to suspend when idle.
 * (Keeping Neon awake 24/7 was costing ~180 compute-hours a month on a free
 * plan with 100 shared across every project.)
 *
 * GET /api/health?db=1: also runs SELECT 1 to prove the database is reachable.
 */
export async function GET(req: Request) {
  const start = Date.now();
  const wantDb = new URL(req.url).searchParams.get("db") === "1";
  if (!wantDb) return NextResponse.json({ ok: true, ms: Date.now() - start });
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - start });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}

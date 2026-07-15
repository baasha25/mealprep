import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Health check that also warms the Neon compute. Point a free cron
// (cron-job.org / UptimeRobot) at /api/health every ~4 min during active
// hours to avoid cold-start latency on the first real request.
export async function GET() {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - start });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Guarded by the shared cron secret so only your scheduler can trigger it.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

/**
 * Sweep throwaway demo tenants older than a day. Subscriptions are deleted first
 * because Subscription→Plan is a restrict relation (the Business cascade would
 * otherwise trip an FK), matching the seed's teardown order.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await db.business.findMany({
      where: { isDemo: true, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    const ids = stale.map((b) => b.id);
    if (ids.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

    await db.subscription.deleteMany({ where: { businessId: { in: ids } } });
    const res = await db.business.deleteMany({ where: { id: { in: ids }, isDemo: true } });
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (err) {
    console.error("[cron:demo-cleanup]", err);
    return NextResponse.json({ ok: false, error: "run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

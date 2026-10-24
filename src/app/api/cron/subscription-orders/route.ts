import { NextRequest, NextResponse } from "next/server";
import { materializeSubscriptionOrders } from "@/lib/subscription-orders-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hourly: turn every subscription delivery whose cut-off has passed into a paid
// order (one per subscription per delivery date — reruns are no-ops). Guarded by
// the shared CRON_SECRET like the other cron routes.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const summary = await materializeSubscriptionOrders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron:subscription-orders]", err);
    return NextResponse.json({ ok: false, error: "run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

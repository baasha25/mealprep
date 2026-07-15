import { NextRequest, NextResponse } from "next/server";
import { runDailyNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Guarded by a shared secret so only your scheduler can trigger sends.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run until a secret is configured
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runDailyNotifications();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron:notifications]", err);
    return NextResponse.json({ ok: false, error: "run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

import { NextRequest, NextResponse } from "next/server";
import { accruePlatformFeeShares, previousMonth } from "@/lib/partner-commission";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Monthly: accrue each partner's share of last month's platform fees.
// Same shared-secret guard as the other cron routes. `?month=YYYY-MM` overrides
// the period (idempotent, so re-running a month is safe).
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const m = req.nextUrl.searchParams.get("month");
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : previousMonth();
  try {
    const summary = await accruePlatformFeeShares(month);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron:partner-fees]", err);
    return NextResponse.json({ ok: false, error: "run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

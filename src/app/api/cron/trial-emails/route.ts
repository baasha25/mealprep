import { NextRequest, NextResponse } from "next/server";
import { runTrialEmails } from "@/lib/trial-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Same shared-secret guard as the other cron routes. Daily; every send is idempotent.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const summary = await runTrialEmails();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron:trial-emails]", err);
    return NextResponse.json({ ok: false, error: "run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

// Netlify Scheduled Function — on the 2nd of each month, asks the app to accrue
// every partner's share of LAST month's platform fees. Idempotent per kitchen
// per month, so a re-run is harmless. "0 6 2 * *" = 06:00 UTC on the 2nd.

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) {
    console.error("partner-fees: missing URL or CRON_SECRET env");
    return new Response("misconfigured", { status: 500 });
  }
  const res = await fetch(`${base}/api/cron/partner-fees`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.text();
  console.log(`partner-fees → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: "0 6 2 * *" };

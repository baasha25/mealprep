// Netlify Scheduled Function — every hour at :10: ask the app to turn subscriber
// picks into orders for every delivery whose cut-off has just passed. Hourly
// because each kitchen sets its own cut-off time and timezone. Idempotent.
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) return new Response("misconfigured", { status: 500 });
  const res = await fetch(`${base}/api/cron/subscription-orders`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.text();
  console.log(`hourly-subscription-orders → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
export const config = { schedule: "10 * * * *" };

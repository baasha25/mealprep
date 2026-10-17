// Netlify Scheduled Function — Mondays 07:00 UTC: refresh watched competitors'
// public menu prices and rebuild match suggestions.
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) return new Response("misconfigured", { status: 500 });
  const res = await fetch(`${base}/api/cron/competitors`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.text();
  console.log(`weekly-competitors → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
export const config = { schedule: "0 7 * * 1" };

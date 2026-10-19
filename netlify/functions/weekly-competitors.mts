// Netlify Scheduled Function — daily 07:00 UTC: refresh watched competitors whose
// prices are 6+ days old (within a time budget) and rebuild match suggestions.
// Daily rather than weekly so slow AI reads drain across the week.
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) return new Response("misconfigured", { status: 500 });
  const res = await fetch(`${base}/api/cron/competitors`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.text();
  console.log(`weekly-competitors → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
export const config = { schedule: "0 7 * * *" };

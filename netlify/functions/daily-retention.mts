// Netlify Scheduled Function — once a day, asks the app to run its retention
// emails: abandoned-checkout nudges, win-back emails, and Google review
// requests. All three are idempotent (SentNotification), so a re-run is safe.
// "0 15 * * *" = 15:00 UTC daily (~11am Eastern), a good inbox hour.

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) {
    console.error("daily-retention: missing URL or CRON_SECRET env");
    return new Response("misconfigured", { status: 500 });
  }
  const res = await fetch(`${base}/api/cron/retention`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.text();
  console.log(`daily-retention → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: "0 15 * * *" };

// Netlify Scheduled Function — once a day, asks the app to send free-trial
// reminders to unpaid kitchens (5 days out, last day, just after). Idempotent
// per step (SentNotification). "20 15 * * *" = 15:20 UTC daily (~11am Eastern).

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) {
    console.error("daily-trial-emails: missing URL or CRON_SECRET env");
    return new Response("misconfigured", { status: 500 });
  }
  const res = await fetch(`${base}/api/cron/trial-emails`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  const body = await res.text();
  console.log(`daily-trial-emails → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = { schedule: "20 15 * * *" };

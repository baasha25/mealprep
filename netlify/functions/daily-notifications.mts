// Netlify Scheduled Function — fires once daily and asks the app to send any
// due customer reminders (cut-off + delivery-day). It just calls the app's own
// secured cron route; all the logic lives in the Next.js app.
//
// Schedule is UTC. "0 12 * * *" = 12:00 UTC daily (~8am US Eastern in summer).
// Change the cron string below to shift when reminders go out.

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) {
    console.error("daily-notifications: missing URL or CRON_SECRET env");
    return new Response("misconfigured", { status: 500 });
  }

  const res = await fetch(`${base}/api/cron/notifications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`daily-notifications → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = {
  schedule: "0 12 * * *",
};

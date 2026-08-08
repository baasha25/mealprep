// Netlify Scheduled Function — fires once daily and asks the app to sweep any
// throwaway sales-demo kitchens older than 24h. It just calls the app's own
// secured cron route; all the logic lives in the Next.js app.
//
// Schedule is UTC. "0 9 * * *" = 09:00 UTC daily. Offset from daily-notifications
// (12:00 UTC) so the two don't fire at the same moment.

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!base || !secret) {
    console.error("demo-cleanup: missing URL or CRON_SECRET env");
    return new Response("misconfigured", { status: 500 });
  }

  const res = await fetch(`${base}/api/cron/demo-cleanup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`demo-cleanup → ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};

export const config = {
  schedule: "0 9 * * *",
};

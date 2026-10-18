// Netlify Scheduled Function — pings /api/health every 5 minutes so the Next.js
// server function stays warm (no multi-second cold start on the first dashboard
// request after a quiet spell). The endpoint deliberately does NOT touch the
// database: Neon's free-plan compute hours are shared across every project on
// the account, and keeping it awake 24/7 was burning ~180 hours a month.

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  if (!base) return new Response("no URL", { status: 500 });
  const t = Date.now();
  const res = await fetch(`${base}/api/health`, { headers: { "x-keep-warm": "1" } });
  console.log(`keep-warm → ${res.status} in ${Date.now() - t}ms`);
  return new Response(String(res.status), { status: 200 });
};

export const config = {
  schedule: "*/5 * * * *",
};

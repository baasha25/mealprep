// Netlify Scheduled Function — pings the app's /api/health every 5 minutes so
// the Next.js server function and the Neon compute stay warm. Without this the
// first dashboard request after a quiet spell pays a multi-second cold start
// (measured 5.3s on the sales sandbox, vs ~0.4s warm).

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

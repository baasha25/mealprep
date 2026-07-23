import { headers } from "next/headers";

/**
 * Absolute origin for links in emails and redirects. Prefers a real (non-local)
 * NEXT_PUBLIC_APP_URL when set — for canonical links — otherwise derives it from
 * the incoming request's host, which is always the actual deployed domain. This
 * makes email links work even if the env var is unset or stuck on localhost.
 * Safe to call in any server request context (actions, routes, RSC).
 */
export async function appUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env && env.startsWith("http") && !env.includes("localhost")) return env;

  try {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not in a request context — fall through to the env value.
  }
  return env ?? "";
}

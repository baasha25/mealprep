import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

// Distributed rate limiting backed by Upstash Redis (a sliding window in a shared
// store, so it works across serverless function instances — in-memory would not).
//
// ENV-GATED: without UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN the limiter
// is INERT (allows everything), so dev/CI run fine and rate limiting switches on
// the moment those two vars are set. It also never blocks on its own errors.

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const RATE_LIMIT_ENABLED = Boolean(redis);

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];
const limiters = new Map<string, Ratelimit>();

function limiterFor(name: string, limit: number, window: Window): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${name}:${limit}:${window}`;
  let l = limiters.get(cacheKey);
  if (!l) {
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `pf:rl:${name}`,
      analytics: false,
    });
    limiters.set(cacheKey, l);
  }
  return l;
}

/**
 * Allow `limit` actions per `window` for a given identity (usually an IP).
 * Returns { ok:true } when allowed — and always true when unconfigured or on error.
 */
export async function rateLimit(
  name: string,
  identity: string,
  limit: number,
  window: Window,
): Promise<{ ok: boolean }> {
  const l = limiterFor(name, limit, window);
  if (!l) return { ok: true };
  try {
    const res = await l.limit(identity);
    return { ok: res.success };
  } catch {
    return { ok: true }; // fail open — never take down a flow because Redis hiccuped
  }
}

/** Best-effort client IP from proxy headers (Netlify sets x-nf-client-connection-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Demo-session token. A demo visitor carries a signed cookie naming their
 * throwaway demo kitchen. The signature (HMAC over the business id) makes the
 * cookie unforgeable, so nobody can hand-craft one pointing at a real tenant —
 * and the auth seam ADDITIONALLY only ever loads businesses flagged `isDemo`,
 * so even a broken signature can't reach real data. Fails closed: with no
 * secret set, no token can be minted or verified, and the demo door stays shut.
 */
export const DEMO_COOKIE = "pf_demo";

/** How long a demo session lasts (also the cookie max-age). */
export const DEMO_SESSION_SECONDS = 60 * 60 * 8; // 8 hours — a long sales day

function secret(): string | null {
  const s = process.env.DEMO_SECRET || "";
  return s.length >= 16 ? s : null;
}

function sign(businessId: string, key: string): string {
  return createHmac("sha256", key).update(businessId).digest("base64url");
}

/** Mint a signed token for a demo business id, or null if no secret is set. */
export function signDemoToken(businessId: string): string | null {
  const key = secret();
  if (!key) return null;
  return `${businessId}.${sign(businessId, key)}`;
}

/** Verify a token and return its business id, or null if invalid/unsigned. */
export function verifyDemoToken(token: string | undefined | null): string | null {
  const key = secret();
  if (!key || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const businessId = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(businessId, key);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? businessId : null;
}

/** Whether the demo passcode a rep typed matches the configured one. */
export function checkDemoPasscode(input: string): boolean {
  const expected = process.env.DEMO_PASSCODE || "";
  if (expected.length < 4) return false; // unset/too-weak → door stays shut
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when the demo door is configured at all (both secret + passcode set). */
export function demoEnabled(): boolean {
  return secret() !== null && (process.env.DEMO_PASSCODE || "").length >= 4;
}

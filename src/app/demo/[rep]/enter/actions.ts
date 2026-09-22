"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TIERS } from "@/lib/tiers";
import { trialEndFrom } from "@/lib/trial";
import { seedDemoKitchen } from "@/lib/demo-seed";
import {
  DEMO_COOKIE,
  DEMO_SESSION_SECONDS,
  checkDemoPasscode,
  demoEnabled,
  signDemoToken,
} from "@/lib/demo-session";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export type EnterDemoState = { ok: false; message: string };

/**
 * Open a live demo: verify the shared passcode, provision a FRESH isolated demo
 * kitchen pre-stocked with a costed sample menu + orders, drop a signed cookie,
 * and land the rep in the real dashboard (read-write). Each call makes its own
 * throwaway tenant, so concurrent demos never collide; a cron sweeps them later.
 */
export async function enterDemo(
  _prev: EnterDemoState | null,
  formData: FormData,
): Promise<EnterDemoState> {
  if (!demoEnabled()) {
    return { ok: false, message: "The demo isn't configured yet. Set DEMO_PASSCODE and DEMO_SECRET." };
  }
  // Throttle passcode attempts per IP so the shared code can't be brute-forced
  // (and to stop a bot spamming throwaway demo tenants). Inert until Upstash is set.
  const gate = await rateLimit("demo-enter", await clientIp(), 8, "10 m");
  if (!gate.ok) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }
  const code = String(formData.get("code") ?? "");
  if (!checkDemoPasscode(code)) {
    return { ok: false, message: "That access code isn't right. Check with your team lead." };
  }

  // Branded prospect demo (optional): the link can carry the prospect's brand so
  // the sandbox opens already looking like THEIR kitchen. `keep` days makes the
  // tenant reusable — re-entering the same link returns the same kitchen (with
  // whatever the rep set up) instead of minting a fresh one.
  const rep = String(formData.get("rep") ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const brand = String(formData.get("brand") ?? "").trim().slice(0, 60);
  const colorRaw = String(formData.get("color") ?? "").trim();
  const brandColor = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : "#2f4536";
  const logoRaw = String(formData.get("logo") ?? "").trim();
  const logoUrl = /^https:\/\/[^\s"'<>]{8,300}$/.test(logoRaw) ? logoRaw : null;
  const keepDays = Math.max(0, Math.min(14, Math.floor(Number(formData.get("keep") ?? 0) || 0)));
  const demoKey = keepDays > 0 && brand ? `${rep || "demo"}:${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : null;

  if (demoKey) {
    const existing = await db.business.findFirst({
      where: { demoKey, isDemo: true, OR: [{ demoExpiresAt: null }, { demoExpiresAt: { gt: new Date() } }] },
      select: { id: true },
    });
    if (existing) {
      const token = signDemoToken(existing.id);
      if (token) {
        const store = await cookies();
        store.set(DEMO_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DEMO_SESSION_SECONDS });
        redirect("/dashboard");
      }
    }
  }

  // A ready-to-explore sample kitchen. Comped so no billing banners fire (the
  // dashboard shows the dedicated demo banner instead), and given a trial window
  // so it runs at full Pro level — the demo should show every feature, including
  // the Pro-only AI invoice scanner.
  const business = await db.business.create({
    data: {
      name: brand || "Demo Kitchen",
      slug: `demo-${randomUUID().slice(0, 8)}`,
      isDemo: true,
      brandColor,
      logoUrl,
      demoKey,
      demoExpiresAt: keepDays > 0 ? new Date(Date.now() + keepDays * 86_400_000) : null,
      billingComped: true,
      trialEndsAt: trialEndFrom(),
      settings: { create: { platformFeeBps: TIERS.starter.platformFeeBps } },
    },
    select: { id: true },
  });

  // Stock it with a fully-costed sample menu + orders so the money features
  // (Profitability, Purchasing, Waste, Analytics) show real dollars the instant
  // the rep lands — no manual data entry needed. Best-effort: a seed hiccup must
  // never strand the rep at a broken login, so fall through to an empty kitchen.
  try {
    await seedDemoKitchen(business.id);
  } catch {
    // Leave the kitchen empty rather than block the demo.
  }

  const token = signDemoToken(business.id);
  if (!token) {
    // Secret vanished between the enabled-check and here — clean up, fail closed.
    await db.business.delete({ where: { id: business.id } });
    return { ok: false, message: "The demo isn't configured yet. Set DEMO_SECRET." };
  }

  const store = await cookies();
  store.set(DEMO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_SESSION_SECONDS,
  });

  redirect("/dashboard");
}

/** Leave the demo: clear the cookie. (The tenant is swept by cron.) */
export async function exitDemo(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  redirect("/");
}

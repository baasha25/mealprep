"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TIERS } from "@/lib/tiers";
import {
  DEMO_COOKIE,
  DEMO_SESSION_SECONDS,
  checkDemoPasscode,
  demoEnabled,
  signDemoToken,
} from "@/lib/demo-session";

export type EnterDemoState = { ok: false; message: string };

/**
 * Open a live demo: verify the shared passcode, provision a FRESH, EMPTY,
 * isolated demo kitchen for this session, drop a signed cookie, and land the
 * rep in the real dashboard (read-write). Each call makes its own throwaway
 * tenant, so concurrent demos never collide; a cron sweeps them later.
 */
export async function enterDemo(
  _prev: EnterDemoState | null,
  formData: FormData,
): Promise<EnterDemoState> {
  if (!demoEnabled()) {
    return { ok: false, message: "The demo isn't configured yet. Set DEMO_PASSCODE and DEMO_SECRET." };
  }
  const code = String(formData.get("code") ?? "");
  if (!checkDemoPasscode(code)) {
    return { ok: false, message: "That access code isn't right. Check with your team lead." };
  }

  // A blank kitchen the rep fills in live — default settings only, no meals,
  // customers, or orders. Comped + no trial so no billing banners fire; the
  // dashboard shows the dedicated demo banner instead.
  const business = await db.business.create({
    data: {
      name: "Demo Kitchen",
      slug: `demo-${randomUUID().slice(0, 8)}`,
      isDemo: true,
      billingComped: true,
      settings: { create: { platformFeeBps: TIERS.starter.platformFeeBps } },
    },
    select: { id: true },
  });

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

"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";

export type ConnectResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * Start (or resume) Stripe Connect Express onboarding for the current kitchen.
 * Creates the connected account on first use, then returns a Stripe-hosted
 * onboarding link where the owner enters their business + bank details.
 */
export async function startConnectOnboarding(): Promise<ConnectResult> {
  if (!STRIPE_ENABLED) return { ok: false, message: "Payments aren't configured yet." };
  const { business } = await requireOwner();

  try {
    let accountId = business.stripeAccountId;
    if (!accountId) {
      const owner = await db.user.findFirst({
        where: { businessId: business.id, role: "owner" },
        select: { email: true },
      });
      const account = await stripe.accounts.create({
        type: "express",
        email: owner?.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: { name: business.name },
        metadata: { businessId: business.id },
      });
      accountId = account.id;
      await db.business.update({ where: { id: business.id }, data: { stripeAccountId: accountId } });
    }

    const h = await headers();
    const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/payouts`,
      return_url: `${origin}/dashboard/payouts?connected=1`,
      type: "account_onboarding",
    });

    return link.url ? { ok: true, url: link.url } : { ok: false, message: "Couldn't start onboarding." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    console.error("[connect] onboarding failed:", msg);
    if (/platform profile|complete your platform/i.test(msg)) {
      return {
        ok: false,
        message:
          "Stripe is still reviewing the platform profile. Once it's approved (usually a few minutes to a day) this will work — please try again shortly.",
      };
    }
    if (/connect/i.test(msg)) {
      return {
        ok: false,
        message:
          "Stripe Connect isn't fully set up yet. Finish setup in your Stripe Dashboard (Connect → platform setup), then try again.",
      };
    }
    return { ok: false, message: "Couldn't start Stripe onboarding. Please try again in a few minutes." };
  }
}

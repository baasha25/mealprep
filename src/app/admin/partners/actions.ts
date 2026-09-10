"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { stripe, STRIPE_ENABLED, PLATFORM_CURRENCY } from "@/lib/stripe";
import { normalizeRef } from "@/lib/attribution";

export type ActionResult = { ok: boolean; message: string; url?: string };

const CreateInput = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  company: z.string().trim().max(120).optional(),
  code: z.string().trim().min(2, "Code must be at least 2 characters"),
  commissionPct: z.coerce.number().min(0, "Can't be negative").max(50, "Keep it 50% or under"),
});

/** Create a partner with a unique ref code and commission rate. */
export async function createPartner(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = CreateInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    code: formData.get("code"),
    commissionPct: formData.get("commissionPct"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid details." };

  const code = normalizeRef(parsed.data.code);
  if (code.length < 2) return { ok: false, message: "Code must be 2+ letters/numbers (a–z, 0–9, - or _)." };

  const clash = await db.partner.findUnique({ where: { code }, select: { id: true } });
  if (clash) return { ok: false, message: `The code "${code}" is already taken — pick another.` };

  await db.partner.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company || null,
      code,
      commissionBps: Math.round(parsed.data.commissionPct * 100),
    },
  });
  revalidatePath("/admin/partners");
  return { ok: true, message: `Partner "${parsed.data.name}" created with code ${code}.` };
}

/** Pause / reactivate a partner (paused partners accrue no new commissions). */
export async function setPartnerStatus(id: string, status: "active" | "paused"): Promise<ActionResult> {
  await requireSuperAdmin();
  await db.partner.update({ where: { id }, data: { status } });
  revalidatePath(`/admin/partners/${id}`);
  revalidatePath("/admin/partners");
  return { ok: true, message: `Partner ${status === "active" ? "reactivated" : "paused"}.` };
}

/**
 * Start (or resume) Stripe Connect Express onboarding for a partner so they can
 * RECEIVE payouts. Creates the connected account on first use, returns a
 * Stripe-hosted onboarding link to send to the partner.
 */
export async function startPartnerConnect(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!STRIPE_ENABLED) return { ok: false, message: "Stripe isn't configured in this environment." };

  const partner = await db.partner.findUnique({ where: { id } });
  if (!partner) return { ok: false, message: "Partner not found." };

  try {
    let accountId = partner.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: partner.email || undefined,
        capabilities: { transfers: { requested: true } },
        business_profile: { name: partner.company || partner.name },
        metadata: { partnerId: partner.id, kind: "partner" },
      });
      accountId = account.id;
      await db.partner.update({ where: { id }, data: { stripeAccountId: accountId } });
    }

    const h = await headers();
    const origin = h.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/admin/partners/${id}`,
      return_url: `${origin}/admin/partners/${id}?connected=1`,
      type: "account_onboarding",
    });
    return link.url ? { ok: true, message: "Onboarding link ready.", url: link.url } : { ok: false, message: "Couldn't create the onboarding link." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    console.error("[partner-connect] onboarding failed:", msg);
    return { ok: false, message: "Couldn't start Stripe onboarding — check the platform's Connect setup, then retry." };
  }
}

/** Re-check the partner's Stripe account and update whether payouts are enabled. */
export async function refreshPartnerConnect(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!STRIPE_ENABLED) return { ok: false, message: "Stripe isn't configured in this environment." };
  const partner = await db.partner.findUnique({ where: { id } });
  if (!partner?.stripeAccountId) return { ok: false, message: "This partner hasn't started Stripe onboarding yet." };
  try {
    const acct = await stripe.accounts.retrieve(partner.stripeAccountId);
    const enabled = Boolean(acct.payouts_enabled);
    await db.partner.update({ where: { id }, data: { payoutsEnabled: enabled } });
    revalidatePath(`/admin/partners/${id}`);
    return { ok: true, message: enabled ? "Payouts are enabled for this partner." : "Stripe onboarding isn't complete yet." };
  } catch (err) {
    console.error("[partner-connect] refresh failed:", err instanceof Error ? err.message : err);
    return { ok: false, message: "Couldn't check the Stripe account. Try again shortly." };
  }
}

/**
 * MANUAL payout: approve and pay a partner's entire pending balance in one
 * Stripe transfer to their connected account, then mark those commissions paid.
 * This is the only place money moves — a super-admin triggers it explicitly.
 */
export async function payPartner(id: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!STRIPE_ENABLED) return { ok: false, message: "Stripe isn't configured in this environment." };

  const partner = await db.partner.findUnique({ where: { id } });
  if (!partner) return { ok: false, message: "Partner not found." };
  if (!partner.stripeAccountId || !partner.payoutsEnabled) {
    return { ok: false, message: "Partner hasn't finished Stripe onboarding — can't send a payout yet." };
  }

  const pending = await db.partnerCommission.findMany({
    where: { partnerId: id, status: "pending" },
    select: { id: true, amountCents: true },
  });
  const amount = pending.reduce((s, c) => s + c.amountCents, 0);
  if (pending.length === 0 || amount <= 0) return { ok: false, message: "Nothing pending to pay." };

  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency: PLATFORM_CURRENCY,
      destination: partner.stripeAccountId,
      description: `PrepFlow partner payout — ${partner.name}`,
      metadata: { partnerId: partner.id, kind: "partner_payout", commissionCount: String(pending.length) },
    });

    const payout = await db.partnerPayout.create({
      data: {
        partnerId: partner.id,
        amountCents: amount,
        currency: PLATFORM_CURRENCY,
        stripeTransferId: transfer.id,
        periodLabel: new Date().toISOString().slice(0, 7),
      },
    });
    await db.partnerCommission.updateMany({
      where: { id: { in: pending.map((c) => c.id) } },
      data: { status: "paid", paidAt: new Date(), payoutId: payout.id },
    });

    revalidatePath(`/admin/partners/${id}`);
    revalidatePath("/admin/partners");
    return { ok: true, message: `Paid ${fmt(amount)} to ${partner.name} (${pending.length} commission${pending.length === 1 ? "" : "s"}).` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    console.error("[partner-payout] transfer failed:", msg);
    if (/insufficient/i.test(msg)) return { ok: false, message: "Your Stripe balance is too low to cover this payout right now." };
    return { ok: false, message: "The Stripe transfer failed — nothing was marked paid. Try again shortly." };
  }
}

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: PLATFORM_CURRENCY.toUpperCase() }).format(cents / 100);
}

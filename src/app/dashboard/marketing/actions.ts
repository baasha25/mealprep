"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, requireOwner } from "@/lib/auth";
import { dollarsToCents, formatCents } from "@/lib/money";
import { sendCampaignEmail, sendGiftCard } from "@/lib/email";

export type FormState = { ok: boolean; message?: string };

/* ---------------------------- Email campaigns --------------------------- */

const CampaignInput = z.object({
  segment: z.enum(["all", "lapsed", "subscribers"]),
  subject: z.string().trim().min(1, "Subject is required").max(140),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

const LAPSED_DAYS = 45;
const MAX_RECIPIENTS = 200;

/** Send a one-off marketing email to a customer segment (owner-triggered). */
export async function sendEmailCampaign(input: {
  segment: string;
  subject: string;
  message: string;
}): Promise<FormState & { count?: number }> {
  const { business } = await requireOwner();
  const parsed = CampaignInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  }
  const { segment, subject, message } = parsed.data;

  let emails: string[] = [];
  if (segment === "subscribers") {
    const subs = await db.subscription.findMany({
      where: { businessId: business.id, status: "active" },
      select: { customer: { select: { email: true } } },
    });
    emails = subs.map((s) => s.customer?.email).filter((e): e is string => Boolean(e));
  } else if (segment === "lapsed") {
    const cutoff = new Date(Date.now() - LAPSED_DAYS * 86_400_000);
    const customers = await db.customer.findMany({
      where: { businessId: business.id },
      select: { email: true, orders: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    emails = customers
      .filter((c) => {
        const last = c.orders[0]?.createdAt;
        return !last || last < cutoff;
      })
      .map((c) => c.email);
  } else {
    const customers = await db.customer.findMany({
      where: { businessId: business.id },
      select: { email: true },
    });
    emails = customers.map((c) => c.email);
  }

  const unique = [...new Set(emails.filter(Boolean))].slice(0, MAX_RECIPIENTS);
  if (unique.length === 0) return { ok: false, message: "No customers match that segment." };

  // Send in small parallel batches to stay well under provider rate limits.
  let sent = 0;
  for (let i = 0; i < unique.length; i += 5) {
    await Promise.all(
      unique.slice(i, i + 5).map(async (to) => {
        await sendCampaignEmail({ to, businessName: business.name, brandColor: business.brandColor, subject, message });
        sent++;
      }),
    );
  }
  return { ok: true, message: `Campaign sent to ${sent} customer${sent === 1 ? "" : "s"}.`, count: sent };
}

/* -------------------------------- Coupons ------------------------------- */

const CouponInput = z
  .object({
    code: z.string().trim().toUpperCase().min(2, "Code is required").max(24),
    type: z.enum(["percent", "flat"]),
    // For percent: whole percent (1–100). For flat: dollars.
    value: z.coerce.number().positive("Enter a value"),
  })
  .refine((d) => (d.type === "percent" ? d.value <= 100 : true), {
    message: "Percent can't exceed 100",
    path: ["value"],
  });

export async function createCoupon(_prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const parsed = CouponInput.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid coupon." };
  }
  const d = parsed.data;
  const value = d.type === "percent" ? Math.round(d.value) : dollarsToCents(d.value);

  const exists = await db.coupon.findFirst({
    where: { businessId: business.id, code: d.code },
    select: { id: true },
  });
  if (exists) return { ok: false, message: `Coupon ${d.code} already exists.` };

  await db.coupon.create({
    data: { businessId: business.id, code: d.code, type: d.type, value, active: true },
  });
  revalidatePath("/dashboard/marketing");
  return { ok: true, message: `Coupon ${d.code} created.` };
}

export async function toggleCoupon(formData: FormData) {
  const { business } = await requireBusiness();
  const id = String(formData.get("couponId"));
  const c = await db.coupon.findFirst({ where: { id, businessId: business.id }, select: { active: true } });
  if (!c) return;
  await db.coupon.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/dashboard/marketing");
}

export async function deleteCoupon(formData: FormData) {
  const { business } = await requireBusiness();
  const id = String(formData.get("couponId"));
  const c = await db.coupon.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
  if (!c) return;
  await db.coupon.delete({ where: { id } });
  revalidatePath("/dashboard/marketing");
}

/* ------------------------------ Gift cards ------------------------------ */

const GiftCardInput = z.object({
  amount: z.coerce.number().positive("Enter an amount").max(100000),
  recipientEmail: z.union([z.string().trim().toLowerCase().email(), z.literal("")]).optional(),
});

// Ambiguity-free code alphabet (no 0/O/1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function giftCode(seed: number): string {
  let s = "";
  let n = seed;
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[n % CODE_ALPHABET.length];
    n = Math.floor(n / CODE_ALPHABET.length) + (i + 1) * 7;
  }
  return `GIFT-${s}`;
}

export async function createGiftCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const parsed = GiftCardInput.safeParse({
    amount: formData.get("amount"),
    recipientEmail: formData.get("recipientEmail") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid gift card." };
  }
  const amountCents = dollarsToCents(parsed.data.amount);

  // Find a free code (seed varies by current card count; retry on collision).
  const base = await db.giftCard.count({ where: { businessId: business.id } });
  let code = giftCode(base + 1);
  for (let attempt = 0; attempt < 6; attempt++) {
    const clash = await db.giftCard.findFirst({ where: { businessId: business.id, code }, select: { id: true } });
    if (!clash) break;
    code = giftCode(base + 1 + attempt * 131 + code.length);
  }

  await db.giftCard.create({
    data: {
      businessId: business.id,
      code,
      amountCents,
      balanceCents: amountCents,
      recipientEmail: parsed.data.recipientEmail || null,
    },
  });

  // Email the recipient their code (best-effort; requires a recipient email).
  if (parsed.data.recipientEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await sendGiftCard({
      to: parsed.data.recipientEmail,
      businessName: business.name,
      brandColor: business.brandColor,
      code,
      amountLabel: formatCents(amountCents),
      storeUrl: business.slug ? `${appUrl}/store/${business.slug}` : appUrl,
    });
  }

  revalidatePath("/dashboard/marketing");
  return { ok: true, message: `Gift card ${code} issued.` };
}

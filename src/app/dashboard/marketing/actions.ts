"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, requireOwner, assertWritable } from "@/lib/auth";
import { dollarsToCents, formatCents } from "@/lib/money";
import { appUrl } from "@/lib/app-url";
import { sendCampaignEmail, sendGiftCard } from "@/lib/email";
import {
  CLOUDINARY_ENABLED,
  cloudinaryPublicConfig,
  signCloudinaryParams,
  isCloudinaryUrl,
} from "@/lib/cloudinary";
import { ANTHROPIC_ENABLED } from "@/lib/anthropic";
import { rateLimit } from "@/lib/ratelimit";
import { publicStoreUrls } from "@/lib/storefront";
import { templateByKey } from "@/lib/campaign-templates";
import { draftCampaignCopy } from "@/lib/campaign-copy";
import { topMealNames } from "@/lib/campaign-data";

export type FormState = { ok: boolean; message?: string };

/* ---------------------------- Email campaigns --------------------------- */

const CampaignInput = z.object({
  segment: z.enum(["all", "lapsed", "subscribers"]),
  subject: z.string().trim().min(1, "Subject is required").max(140),
  message: z.string().trim().min(1, "Message is required").max(4000),
  // Optional banner image (Cloudinary URL); anything else is dropped.
  imageUrl: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s && isCloudinaryUrl(s) ? s : undefined;
  }, z.string().optional()),
  // A template's suggested coupon, created (if missing) when the campaign sends
  // so the code in the email actually works at checkout.
  coupon: z
    .object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,16}$/, "Coupon code: 3–16 letters/numbers"),
      type: z.enum(["percent", "flat"]),
      value: z.number().int().min(1).max(100000),
    })
    .optional(),
});

export type CampaignUploadSignature =
  | { ok: true; cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }
  | { ok: false; message: string };

/** Sign a direct-to-Cloudinary upload for a campaign banner image (owner-gated). */
export async function signCampaignImageUpload(): Promise<CampaignUploadSignature> {
  const { business } = await requireOwner();
  if (!CLOUDINARY_ENABLED) return { ok: false, message: "Image uploads aren't set up yet." };
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `prepflow/campaigns/${business.id}`;
  const signature = signCloudinaryParams({ folder, timestamp });
  const { cloudName, apiKey } = cloudinaryPublicConfig();
  return { ok: true, cloudName, apiKey, timestamp, signature, folder };
}

const LAPSED_DAYS = 45;
const MAX_RECIPIENTS = 200;

/** Send a one-off marketing email to a customer segment (owner-triggered). */
export async function sendEmailCampaign(input: {
  segment: string;
  subject: string;
  message: string;
  imageUrl?: string;
  coupon?: { code: string; type: "percent" | "flat"; value: number };
}): Promise<FormState & { count?: number }> {
  const { business } = await requireOwner();
  const parsed = CampaignInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  }
  const { segment, subject, message, imageUrl, coupon } = parsed.data;

  // The code promised in the email must exist before anyone clicks.
  let couponNote = "";
  if (coupon) {
    if (coupon.type === "percent" && coupon.value > 100) return { ok: false, message: "A percent coupon can't exceed 100%." };
    const existing = await db.coupon.findUnique({ where: { businessId_code: { businessId: business.id, code: coupon.code } } });
    if (!existing) {
      await db.coupon.create({ data: { businessId: business.id, code: coupon.code, type: coupon.type, value: coupon.value, active: true } });
      couponNote = ` Coupon ${coupon.code} created.`;
    } else if (!existing.active) {
      await db.coupon.update({ where: { id: existing.id }, data: { active: true } });
      couponNote = ` Coupon ${coupon.code} switched back on.`;
    }
    revalidatePath("/dashboard/marketing");
  }

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
        await sendCampaignEmail({ to, businessId: business.id, businessName: business.name, brandColor: business.brandColor, subject, message, imageUrl });
        sent++;
      }),
    );
  }
  return { ok: true, message: `Campaign sent to ${sent} customer${sent === 1 ? "" : "s"}.${couponNote}`, count: sent };
}

/* ------------------------- AI copy ("Write it for me") ------------------------ */

export type DraftResult = { ok: true; subject: string; message: string } | { ok: false; message: string };

/**
 * Ask Claude to write (or rewrite) the campaign from the kitchen's own facts:
 * name, service area, best-selling dishes, cut-off, store link, the chosen
 * template's occasion and the coupon. Gated by ANTHROPIC_API_KEY; rate-limited.
 */
export async function draftCampaign(input: {
  templateKey?: string;
  segment: "all" | "lapsed" | "subscribers";
  subject: string;
  message: string;
  coupon?: { code: string; type: "percent" | "flat"; value: number };
}): Promise<DraftResult> {
  const { business } = await requireOwner();
  if (!ANTHROPIC_ENABLED) return { ok: false, message: "AI writing isn't switched on for this installation yet." };
  if (!(await rateLimit("campaign-draft", business.id, 20, "1 h")).ok) return { ok: false, message: "That's a lot of drafts — try again in an hour." };

  const [settings, top, urls] = await Promise.all([
    db.businessSettings.findUnique({ where: { businessId: business.id }, select: { serviceArea: true, cutoff: true } }),
    topMealNames(business.id, 3),
    publicStoreUrls(business),
  ]);
  const t = input.templateKey ? templateByKey(input.templateKey) : undefined;
  const offer = input.coupon
    ? `${input.coupon.type === "percent" ? `${input.coupon.value}% off` : `$${(input.coupon.value / 100).toFixed(2)} off`} with code ${input.coupon.code.toUpperCase()}`
    : null;
  try {
    const d = await draftCampaignCopy({
      kitchen: business.name,
      serviceArea: settings?.serviceArea ?? null,
      segment: input.segment,
      template: t ? { label: t.label, brief: t.brief } : null,
      currentSubject: String(input.subject ?? "").slice(0, 140),
      currentMessage: String(input.message ?? "").slice(0, 4000),
      offer,
      topMeals: top,
      storeUrl: urls.order,
      cutoff: settings?.cutoff ?? "",
    });
    return { ok: true, ...d };
  } catch (err) {
    console.error("[campaign-draft] failed:", err);
    return { ok: false, message: "Couldn't write a draft just now. Try again in a moment." };
  }
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
  await assertWritable(business);
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
    const base = await appUrl();
    await sendGiftCard({
      businessId: business.id,
      to: parsed.data.recipientEmail,
      businessName: business.name,
      brandColor: business.brandColor,
      code,
      amountLabel: formatCents(amountCents),
      storeUrl: business.slug ? `${base}/store/${business.slug}` : base,
    });
  }

  revalidatePath("/dashboard/marketing");
  return { ok: true, message: `Gift card ${code} issued.` };
}

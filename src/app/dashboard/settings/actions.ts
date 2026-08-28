"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, assertWritable } from "@/lib/auth";
import { dollarsToCents, percentToBps } from "@/lib/money";
import { TIERS } from "@/lib/tiers";
import { TIMEZONE_VALUES, DEFAULT_TIMEZONE } from "@/lib/cutoff";
import {
  CLOUDINARY_ENABLED,
  cloudinaryPublicConfig,
  signCloudinaryParams,
  isCloudinaryUrl,
} from "@/lib/cloudinary";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Input is the human form (dollars, whole-percent). We convert to cents/bps on save.
const SettingsInput = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Brand color must be a hex value like #2f4536"),
  // Merchant logo URL from the client-side Cloudinary upload. Only a genuine
  // Cloudinary delivery URL is stored; anything else (incl. empty) becomes null.
  logoUrl: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s && isCloudinaryUrl(s) ? s : null;
  }, z.string().nullable()),
  subDiscount: z.coerce.number().min(0).max(100),
  taxRate: z.coerce.number().min(0).max(100),
  tier: z.enum(["starter", "growth", "pro"]),
  deliveryFee: z.coerce.number().min(0).max(1000),
  processingFee: z.coerce.number().min(0).max(1000),
  minOrder: z.coerce.number().min(0).max(100000),
  minMeals: z.coerce.number().int().min(0).max(100),
  cutoff: z.string().trim().max(60),
  timezone: z.preprocess(
    (v) => (TIMEZONE_VALUES.includes(String(v)) ? v : DEFAULT_TIMEZONE),
    z.string(),
  ),
  fulfillment: z.enum(["delivery", "pickup", "both"]),
  deliveryDays: z.record(z.enum(DAYS), z.boolean()),
  pickupLocations: z.array(z.string().trim().min(1)),
  // Loyalty & referrals
  loyaltyEnabled: z.boolean(),
  loyaltyPointsPerDollar: z.coerce.number().int().min(0).max(1000),
  loyaltyRedeemCentsPerPoint: z.coerce.number().int().min(1).max(1000),
  referralBonusPoints: z.coerce.number().int().min(0).max(1_000_000),
  // Customer notifications
  notifyCutoff: z.boolean(),
  notifyDeliveryDay: z.boolean(),
});

export type SettingsActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export async function updateSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { business } = await requireBusiness();
  await assertWritable(business);

  const deliveryDays = Object.fromEntries(
    DAYS.map((d) => [d, formData.get(`day_${d}`) === "on"]),
  );
  const pickupLocations = String(formData.get("pickupLocations") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = SettingsInput.safeParse({
    name: formData.get("name"),
    brandColor: formData.get("brandColor"),
    logoUrl: formData.get("logoUrl"),
    subDiscount: formData.get("subDiscount"),
    taxRate: formData.get("taxRate"),
    tier: formData.get("tier"),
    deliveryFee: formData.get("deliveryFee"),
    processingFee: formData.get("processingFee"),
    minOrder: formData.get("minOrder"),
    minMeals: formData.get("minMeals"),
    cutoff: formData.get("cutoff"),
    timezone: formData.get("timezone"),
    fulfillment: formData.get("fulfillment"),
    deliveryDays,
    pickupLocations,
    loyaltyEnabled: formData.get("loyaltyEnabled") === "on",
    loyaltyPointsPerDollar: formData.get("loyaltyPointsPerDollar"),
    loyaltyRedeemCentsPerPoint: formData.get("loyaltyRedeemCentsPerPoint"),
    referralBonusPoints: formData.get("referralBonusPoints"),
    notifyCutoff: formData.get("notifyCutoff") === "on",
    notifyDeliveryDay: formData.get("notifyDeliveryDay") === "on",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }

  const d = parsed.data;

  // When the kitchen has a paid subscription, the plan is owned by Stripe — a
  // tier change must go through the billing portal, not this form (else desync).
  const effectiveTier = business.billingStatus === "active" ? (business.tier as typeof d.tier) : d.tier;

  // Business identity + settings updated atomically, scoped to this tenant.
  await db.$transaction([
    db.business.update({
      where: { id: business.id },
      data: { name: d.name, brandColor: d.brandColor, logoUrl: d.logoUrl, tier: effectiveTier },
    }),
    db.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        subDiscountBps: percentToBps(d.subDiscount),
        taxRateBps: percentToBps(d.taxRate),
        platformFeeBps: TIERS[effectiveTier].platformFeeBps,
        deliveryFeeCents: dollarsToCents(d.deliveryFee),
        processingFeeCents: dollarsToCents(d.processingFee),
        minOrderCents: dollarsToCents(d.minOrder),
        minMeals: d.minMeals,
        cutoff: d.cutoff,
        timezone: d.timezone,
        fulfillment: d.fulfillment,
        deliveryDays: d.deliveryDays,
        pickupLocations: d.pickupLocations,
        loyaltyEnabled: d.loyaltyEnabled,
        loyaltyPointsPerDollar: d.loyaltyPointsPerDollar,
        loyaltyRedeemCentsPerPoint: d.loyaltyRedeemCentsPerPoint,
        referralBonusPoints: d.referralBonusPoints,
        notifyCutoff: d.notifyCutoff,
        notifyDeliveryDay: d.notifyDeliveryDay,
      },
      update: {
        subDiscountBps: percentToBps(d.subDiscount),
        taxRateBps: percentToBps(d.taxRate),
        platformFeeBps: TIERS[effectiveTier].platformFeeBps,
        deliveryFeeCents: dollarsToCents(d.deliveryFee),
        processingFeeCents: dollarsToCents(d.processingFee),
        minOrderCents: dollarsToCents(d.minOrder),
        minMeals: d.minMeals,
        cutoff: d.cutoff,
        timezone: d.timezone,
        fulfillment: d.fulfillment,
        deliveryDays: d.deliveryDays,
        pickupLocations: d.pickupLocations,
        loyaltyEnabled: d.loyaltyEnabled,
        loyaltyPointsPerDollar: d.loyaltyPointsPerDollar,
        loyaltyRedeemCentsPerPoint: d.loyaltyRedeemCentsPerPoint,
        referralBonusPoints: d.referralBonusPoints,
        notifyCutoff: d.notifyCutoff,
        notifyDeliveryDay: d.notifyDeliveryDay,
      },
    }),
  ]);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Settings saved." };
}

export type UploadSignature =
  | { ok: true; cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string }
  | { ok: false; message: string };

/**
 * Mint a short-lived signature so the browser can upload the merchant's logo
 * straight to Cloudinary — the API secret never leaves the server. Scoped to the
 * caller's business (its own folder) and owner-gated via requireBusiness.
 */
export async function signLogoUpload(): Promise<UploadSignature> {
  const { business } = await requireBusiness();
  if (!CLOUDINARY_ENABLED) {
    return { ok: false, message: "Logo uploads aren't set up yet." };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `prepflow/logos/${business.id}`;
  const signature = signCloudinaryParams({ folder, timestamp });
  const { cloudName, apiKey } = cloudinaryPublicConfig();
  return { ok: true, cloudName, apiKey, timestamp, signature, folder };
}

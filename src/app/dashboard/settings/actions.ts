"use server";

import { z } from "zod";
import { VERTICALS } from "@/lib/verticals";
import { normalizePostalCode } from "@/lib/regions";
import { isValidHostname } from "@/lib/custom-domains";
import { validateZones } from "@/lib/zones";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, requireOwner, assertWritable } from "@/lib/auth";
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
  // White-label: the kitchen's own hostname (activation is a concierge step).
  customDomain: z.preprocess(
    (v) => String(v ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""),
    z.string().max(253).refine((h) => h === "" || isValidHostname(h), "Enter a hostname like order.yourkitchen.com (no https:// or path)"),
  ),
  subDiscount: z.coerce.number().min(0).max(100),
  taxRate: z.coerce.number().min(0).max(100),
  tier: z.enum(["starter", "growth", "pro"]),
  vertical: z.enum(VERTICALS),
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
  subscriptionsOnly: z.boolean(),
  subNoPick: z.enum(["skip", "chef_choice"]),
  itemNoun: z.enum(["meal", "portion", "pouch", "bottle", "box", "jar", "loaf", "bowl", "pack", "item"]),
  pickupLocations: z.array(z.string().trim().min(1)),
  // Loyalty & referrals
  loyaltyEnabled: z.boolean(),
  autoApproveReviews: z.boolean(),
  loyaltyPointsPerDollar: z.coerce.number().int().min(0).max(1000),
  loyaltyRedeemCentsPerPoint: z.coerce.number().int().min(1).max(1000),
  referralBonusPoints: z.coerce.number().int().min(0).max(1_000_000),
  // Customer notifications
  notifyCutoff: z.boolean(),
  notifyDeliveryDay: z.boolean(),
  // Retention emails + report assumptions
  notifyAbandoned: z.boolean(),
  notifyWinBack: z.boolean(),
  winBackDays: z.coerce.number().int().min(7).max(365),
  winBackCouponCode: z.string().trim().toUpperCase().max(24).optional().default(""),
  notifyReviewRequest: z.boolean(),
  sharePartnerStats: z.boolean(),
  googleReviewUrl: z.string().trim().max(300).optional().default("").refine((v) => v === "" || /^https:\/\/(g\.page|search\.google\.com|www\.google\.com|maps\.app\.goo\.gl|goo\.gl|business\.google\.com)\//.test(v), "Paste the link Google gives you under 'Ask for reviews' (it starts with https://g.page/ or https://search.google.com/)."),
  reviewRequestDays: z.coerce.number().int().min(1).max(14),
  adminMinutesPerOrder: z.coerce.number().int().min(0).max(60),
  // Catering & large orders
  cateringEnabled: z.boolean(),
  cateringLeadDays: z.coerce.number().int().min(0).max(60),
  cateringMinMeals: z.coerce.number().int().min(0).max(1000),
  cateringIntro: z.string().trim().max(300).optional().default(""),
  // Search & link previews (Brand)
  storeTagline: z.string().trim().max(90, "Keep the tagline under 90 characters").optional().default(""),
  storeDescription: z.string().trim().max(200, "Keep the description under 200 characters — Google shows about 160").optional().default(""),
  serviceArea: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(12).optional().default("").transform((v, ctx) => {
    if (!v) return null;
    const n = normalizePostalCode(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter a postal code like V6E 1A1 or a ZIP like 98101" });
    return n;
  }),
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
    customDomain: formData.get("customDomain") ?? "",
    subDiscount: formData.get("subDiscount"),
    taxRate: formData.get("taxRate"),
    tier: formData.get("tier"),
    vertical: formData.get("vertical") ?? "meal_prep",
    deliveryFee: formData.get("deliveryFee"),
    processingFee: formData.get("processingFee"),
    minOrder: formData.get("minOrder"),
    minMeals: formData.get("minMeals"),
    cutoff: formData.get("cutoff"),
    timezone: formData.get("timezone"),
    fulfillment: formData.get("fulfillment"),
    deliveryDays,
    subscriptionsOnly: formData.get("subscriptionsOnly") === "on",
    subNoPick: formData.get("subNoPick") ?? "skip",
    itemNoun: formData.get("itemNoun") ?? "meal",
    pickupLocations,
    loyaltyEnabled: formData.get("loyaltyEnabled") === "on",
    autoApproveReviews: formData.get("autoApproveReviews") === "on",
    loyaltyPointsPerDollar: formData.get("loyaltyPointsPerDollar"),
    loyaltyRedeemCentsPerPoint: formData.get("loyaltyRedeemCentsPerPoint"),
    referralBonusPoints: formData.get("referralBonusPoints"),
    notifyCutoff: formData.get("notifyCutoff") === "on",
    notifyDeliveryDay: formData.get("notifyDeliveryDay") === "on",
    notifyAbandoned: formData.get("notifyAbandoned") === "on",
    notifyWinBack: formData.get("notifyWinBack") === "on",
    winBackDays: formData.get("winBackDays") ?? 45,
    winBackCouponCode: formData.get("winBackCouponCode") ?? "",
    notifyReviewRequest: formData.get("notifyReviewRequest") === "on",
    sharePartnerStats: formData.get("sharePartnerStats") === "on",
    googleReviewUrl: formData.get("googleReviewUrl") ?? "",
    reviewRequestDays: formData.get("reviewRequestDays") ?? 2,
    adminMinutesPerOrder: formData.get("adminMinutesPerOrder") ?? 4,
    cateringEnabled: formData.get("cateringEnabled") === "on",
    cateringLeadDays: formData.get("cateringLeadDays") ?? 3,
    cateringMinMeals: formData.get("cateringMinMeals") ?? 10,
    cateringIntro: formData.get("cateringIntro") ?? "",
    storeTagline: formData.get("storeTagline") ?? "",
    storeDescription: formData.get("storeDescription") ?? "",
    serviceArea: formData.get("serviceArea") ?? "",
    postalCode: formData.get("postalCode") ?? "",
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

  // A domain can only point at one kitchen.
  if (d.customDomain) {
    const taken = await db.business.findFirst({ where: { customDomain: d.customDomain, id: { not: business.id } }, select: { id: true } });
    if (taken) return { ok: false, message: "That domain is already connected to another kitchen.", errors: { customDomain: "Already in use" } };
  }

  // Business identity + settings updated atomically, scoped to this tenant.
  await db.$transaction([
    db.business.update({
      where: { id: business.id },
      data: { name: d.name, brandColor: d.brandColor, logoUrl: d.logoUrl, customDomain: d.customDomain || null, tier: effectiveTier, vertical: d.vertical, sharePartnerStats: d.sharePartnerStats, postalCode: d.postalCode },
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
        subscriptionsOnly: d.subscriptionsOnly,
        subNoPick: d.subNoPick,
        itemNoun: d.itemNoun,
        pickupLocations: d.pickupLocations,
        loyaltyEnabled: d.loyaltyEnabled,
        autoApproveReviews: d.autoApproveReviews,
        loyaltyPointsPerDollar: d.loyaltyPointsPerDollar,
        loyaltyRedeemCentsPerPoint: d.loyaltyRedeemCentsPerPoint,
        referralBonusPoints: d.referralBonusPoints,
        notifyCutoff: d.notifyCutoff,
        notifyDeliveryDay: d.notifyDeliveryDay,
        notifyAbandoned: d.notifyAbandoned,
        notifyWinBack: d.notifyWinBack,
        winBackDays: d.winBackDays,
        winBackCouponCode: d.winBackCouponCode || null,
        notifyReviewRequest: d.notifyReviewRequest,
        googleReviewUrl: d.googleReviewUrl || null,
        reviewRequestDays: d.reviewRequestDays,
        adminMinutesPerOrder: d.adminMinutesPerOrder,
        cateringEnabled: d.cateringEnabled,
        cateringLeadDays: d.cateringLeadDays,
        cateringMinMeals: d.cateringMinMeals,
        cateringIntro: d.cateringIntro || null,
        storeTagline: d.storeTagline || null,
        storeDescription: d.storeDescription || null,
        serviceArea: d.serviceArea || null,
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
        subscriptionsOnly: d.subscriptionsOnly,
        subNoPick: d.subNoPick,
        itemNoun: d.itemNoun,
        pickupLocations: d.pickupLocations,
        loyaltyEnabled: d.loyaltyEnabled,
        autoApproveReviews: d.autoApproveReviews,
        loyaltyPointsPerDollar: d.loyaltyPointsPerDollar,
        loyaltyRedeemCentsPerPoint: d.loyaltyRedeemCentsPerPoint,
        referralBonusPoints: d.referralBonusPoints,
        notifyCutoff: d.notifyCutoff,
        notifyDeliveryDay: d.notifyDeliveryDay,
        notifyAbandoned: d.notifyAbandoned,
        notifyWinBack: d.notifyWinBack,
        winBackDays: d.winBackDays,
        winBackCouponCode: d.winBackCouponCode || null,
        notifyReviewRequest: d.notifyReviewRequest,
        googleReviewUrl: d.googleReviewUrl || null,
        reviewRequestDays: d.reviewRequestDays,
        adminMinutesPerOrder: d.adminMinutesPerOrder,
        cateringEnabled: d.cateringEnabled,
        cateringLeadDays: d.cateringLeadDays,
        cateringMinMeals: d.cateringMinMeals,
        cateringIntro: d.cateringIntro || null,
        storeTagline: d.storeTagline || null,
        storeDescription: d.storeDescription || null,
        serviceArea: d.serviceArea || null,
      },
    }),
  ]);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  if (business.slug) revalidatePath(`/store/${business.slug}`);
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

/* ----------------------------- Delivery zones ---------------------------- */

export type ZonesActionState = { ok: boolean; message: string } | null;

/** Replace the kitchen's delivery zones with the edited set (owner only). */
export async function saveDeliveryZones(_prev: ZonesActionState, formData: FormData): Promise<ZonesActionState> {
  const { business } = await requireOwner();
  await assertWritable(business);
  let rows: { name: string; prefixes: string; days: Record<string, boolean>; feeDollars: string }[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("zones") ?? "[]"));
    if (!Array.isArray(parsed) || parsed.length > 40) return { ok: false, message: "Up to 40 zones." };
    rows = parsed.map((r) => ({ name: String(r?.name ?? ""), prefixes: String(r?.prefixes ?? ""), days: typeof r?.days === "object" && r.days ? r.days : {}, feeDollars: String(r?.feeDollars ?? "") }));
  } catch {
    return { ok: false, message: "Couldn't read the zones." };
  }
  const v = validateZones(rows);
  if (!v.ok) return { ok: false, message: v.message };
  await db.$transaction([
    db.deliveryZone.deleteMany({ where: { businessId: business.id } }),
    ...(v.zones.length
      ? [db.deliveryZone.createMany({ data: v.zones.map((z, i) => ({ businessId: business.id, name: z.name, postalPrefixes: z.postalPrefixes, deliveryDays: z.deliveryDays, deliveryFeeCents: z.deliveryFeeCents, sortOrder: i })) })]
      : []),
  ]);
  revalidatePath("/dashboard/settings");
  if (business.slug) revalidatePath(`/store/${business.slug}`);
  return { ok: true, message: v.zones.length ? `${v.zones.length} zone${v.zones.length === 1 ? "" : "s"} saved. Your storefront now places customers by postal code.` : "Zones cleared — back to one flat fee and your delivery days." };
}

/* --------------------------- Email sending domain --------------------------- */

import { Prisma } from "@/generated/prisma/client";
import { resendAdmin as resend, EMAIL_ENABLED } from "@/lib/resend-client";
import { normalizeDomain, isValidLocalPart, simplifyRecords } from "@/lib/sender";

export type EmailDomainState = { ok: boolean; message: string } | null;

const EmailPrefs = z.object({
  fromLocal: z.string().trim().toLowerCase().max(40).refine(isValidLocalPart, "Use letters, numbers, dots or dashes, e.g. hello or orders"),
  replyTo: z.string().trim().toLowerCase().max(200).refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address"),
});

/** Connect the kitchen's own sending domain: register it with Resend and store the DNS records to add. */
export async function connectEmailDomain(_prev: EmailDomainState, formData: FormData): Promise<EmailDomainState> {
  const { business } = await requireOwner();
  await assertWritable(business);
  if (!EMAIL_ENABLED || !resend) return { ok: false, message: "Email isn't set up on this deployment yet." };
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) return { ok: false, message: "Enter the domain you send from, e.g. mail.yourkitchen.ca (no https:// or path)." };
  const prefs = EmailPrefs.safeParse({ fromLocal: formData.get("fromLocal") ?? "hello", replyTo: formData.get("replyTo") ?? "" });
  if (!prefs.success) return { ok: false, message: prefs.error.issues[0]?.message ?? "Check the from address." };
  if (business.emailDomainId) return { ok: false, message: "Remove the current domain before connecting another." };
  const taken = await db.business.findFirst({ where: { emailDomain: domain, NOT: { id: business.id } }, select: { id: true } });
  if (taken) return { ok: false, message: "That domain is already connected to another PrepFlow kitchen." };
  const res = await resend.domains.create({ name: domain, region: "us-east-1" });
  if (res.error || !res.data) {
    console.error("[email-domain] create failed:", res.error);
    if (res.error?.name === "restricted_api_key") return { ok: false, message: "Domain setup isn't switched on for this PrepFlow deployment yet. Tell us and we'll enable it — your emails keep going out via PrepFlow meanwhile." };
    return { ok: false, message: res.error?.message?.includes("already") ? "That domain is already registered with our email provider. Contact support and we'll move it over." : "Couldn't register the domain. Try again in a minute." };
  }
  await db.business.update({
    where: { id: business.id },
    data: { emailDomain: domain, emailDomainId: res.data.id, emailDomainStatus: res.data.status ?? "not_started", emailDomainRecords: simplifyRecords(res.data.records), emailFromLocal: prefs.data.fromLocal, emailReplyTo: prefs.data.replyTo || null },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Domain registered. Add the DNS records below at your domain provider, then check." };
}

/** Ask Resend to (re)verify the DNS and refresh the stored status + records. */
export async function checkEmailDomain(): Promise<EmailDomainState> {
  const { business } = await requireOwner();
  if (!EMAIL_ENABLED || !resend || !business.emailDomainId) return { ok: false, message: "No domain to check." };
  try {
    await resend.domains.verify(business.emailDomainId);
  } catch (err) {
    console.error("[email-domain] verify failed:", err);
  }
  const got = await resend.domains.get(business.emailDomainId);
  if (got.error || !got.data) return { ok: false, message: "Couldn't read the domain status. Try again in a minute." };
  await db.business.update({ where: { id: business.id }, data: { emailDomainStatus: got.data.status, emailDomainRecords: simplifyRecords(got.data.records) } });
  revalidatePath("/dashboard/settings");
  const verified = got.data.status === "verified";
  return { ok: true, message: verified ? "Verified — your customer emails now come from your own domain." : `Status: ${got.data.status.replace(/_/g, " ")}. DNS changes can take up to an hour to show; check again later.` };
}

/** Stop sending from the kitchen's domain (back to "via PrepFlow"); removes it from Resend. */
export async function disconnectEmailDomain(): Promise<EmailDomainState> {
  const { business } = await requireOwner();
  await assertWritable(business);
  if (business.emailDomainId && resend) {
    try {
      await resend.domains.remove(business.emailDomainId);
    } catch (err) {
      console.error("[email-domain] remove failed:", err);
    }
  }
  await db.business.update({ where: { id: business.id }, data: { emailDomain: null, emailDomainId: null, emailDomainStatus: null, emailDomainRecords: Prisma.DbNull } });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Domain removed. Emails go out via PrepFlow again, with replies to you." };
}

/** From-address local part + reply-to (works with or without a connected domain). */
export async function saveEmailSender(_prev: EmailDomainState, formData: FormData): Promise<EmailDomainState> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const prefs = EmailPrefs.safeParse({ fromLocal: formData.get("fromLocal") ?? "hello", replyTo: formData.get("replyTo") ?? "" });
  if (!prefs.success) return { ok: false, message: prefs.error.issues[0]?.message ?? "Check the from address." };
  await db.business.update({ where: { id: business.id }, data: { emailFromLocal: prefs.data.fromLocal, emailReplyTo: prefs.data.replyTo || null } });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Sender details saved." };
}

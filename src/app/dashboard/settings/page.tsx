import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { bpsToPercent, centsToDollars } from "@/lib/money";
import { effectiveTier, type TierKey } from "@/lib/tiers";
import { SettingsForm, type SettingsInitial } from "./settings-form";
import { DeliveryZonesCard, type ZoneRow } from "./zones-editor";
import { EmailDomainCard, type EmailDomainInitial } from "./email-domain-card";
import { EMAIL_ENABLED, PLATFORM_FROM } from "@/lib/resend-client";
import { simplifyRecords, senderFor } from "@/lib/sender";
import { enabledDeliveryDays } from "@/lib/delivery-days";

export default async function SettingsPage() {
  const { business } = await requireOwner();
  const referredBy = business.referredByPartnerId
    ? await db.partner.findUnique({ where: { id: business.referredByPartnerId }, select: { name: true } })
    : null;

  // Ensure a settings row exists (defaults defined in the Prisma schema).
  const settings = await db.businessSettings.upsert({
    where: { businessId: business.id },
    create: { businessId: business.id },
    update: {},
  });

  const dd = (settings.deliveryDays ?? {}) as Record<string, boolean>;
  const zones = await db.deliveryZone.findMany({ where: { businessId: business.id, active: true }, orderBy: { sortOrder: "asc" } });
  const zoneRows: ZoneRow[] = zones.map((z) => ({
    name: z.name,
    prefixes: z.postalPrefixes.join(", "),
    days: (z.deliveryDays ?? {}) as Record<string, boolean>,
    feeDollars: z.deliveryFeeCents == null ? "" : centsToDollars(z.deliveryFeeCents).toFixed(2),
  }));

  const owner = await db.user.findFirst({ where: { businessId: business.id, role: "owner" }, select: { email: true } });
  const emailInitial: EmailDomainInitial = {
    enabled: EMAIL_ENABLED,
    domain: business.emailDomain,
    status: business.emailDomainStatus,
    records: simplifyRecords(business.emailDomainRecords),
    fromLocal: business.emailFromLocal,
    replyTo: business.emailReplyTo ?? "",
    ownerEmail: owner?.email ?? "",
    preview: senderFor({ businessName: business.name, emailDomain: business.emailDomain, emailDomainStatus: business.emailDomainStatus, emailFromLocal: business.emailFromLocal, fallbackFrom: PLATFORM_FROM }).from,
  };

  const initial: SettingsInitial = {
    name: business.name,
    brandColor: business.brandColor,
    logoUrl: business.logoUrl ?? "",
    customDomain: business.customDomain ?? "",
    sharePartnerStats: business.sharePartnerStats,
    referredByPartnerName: referredBy?.name ?? null,
    isPro: effectiveTier({ tier: business.tier as TierKey, trialEndsAt: business.trialEndsAt }) === "pro",
    tier: business.tier as TierKey,
    subDiscount: bpsToPercent(settings.subDiscountBps),
    taxRate: bpsToPercent(settings.taxRateBps),
    platformFee: bpsToPercent(settings.platformFeeBps),
    deliveryFee: centsToDollars(settings.deliveryFeeCents),
    processingFee: centsToDollars(settings.processingFeeCents),
    minOrder: centsToDollars(settings.minOrderCents),
    minMeals: settings.minMeals,
    cutoff: settings.cutoff,
    timezone: settings.timezone,
    fulfillment: settings.fulfillment as "delivery" | "pickup" | "both",
    deliveryDays: dd,
    subscriptionsOnly: settings.subscriptionsOnly,
    itemNoun: settings.itemNoun,
    subNoPick: settings.subNoPick === "skip" ? "skip" : "chef_choice",
    pickupLocations: settings.pickupLocations,
    loyaltyEnabled: settings.loyaltyEnabled,
    autoApproveReviews: settings.autoApproveReviews,
    notifyCutoff: settings.notifyCutoff,
    notifyDeliveryDay: settings.notifyDeliveryDay,
    notifyAbandoned: settings.notifyAbandoned,
    notifyWinBack: settings.notifyWinBack,
    winBackDays: settings.winBackDays,
    winBackCouponCode: settings.winBackCouponCode ?? "",
    notifyReviewRequest: settings.notifyReviewRequest,
    googleReviewUrl: settings.googleReviewUrl ?? "",
    reviewRequestDays: settings.reviewRequestDays,
    adminMinutesPerOrder: settings.adminMinutesPerOrder,
    cateringEnabled: settings.cateringEnabled,
    cateringLeadDays: settings.cateringLeadDays,
    cateringMinMeals: settings.cateringMinMeals,
    cateringIntro: settings.cateringIntro ?? "",
    storeTagline: settings.storeTagline ?? "",
    storeDescription: settings.storeDescription ?? "",
    serviceArea: settings.serviceArea ?? "",
    postalCode: business.postalCode ?? "",
    storeUrl: business.slug ? `/store/${business.slug}` : null,
    loyaltyPointsPerDollar: settings.loyaltyPointsPerDollar,
    loyaltyRedeemCentsPerPoint: settings.loyaltyRedeemCentsPerPoint,
    referralBonusPoints: settings.referralBonusPoints,
  };

  return (
    <Page>
      <Head
        kicker="Settings"
        title="Business Settings"
        sub="Fees, taxes, cut-off, and fulfillment — the rules your storefront and billing run on."
      />
      <SettingsForm initial={initial} />
      <DeliveryZonesCard initial={zoneRows} kitchenDays={enabledDeliveryDays(dd)} defaultFeeDollars={centsToDollars(settings.deliveryFeeCents)} />
      <EmailDomainCard initial={emailInitial} />
    </Page>
  );
}

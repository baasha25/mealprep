import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { bpsToPercent, centsToDollars } from "@/lib/money";
import { SettingsForm, type SettingsInitial } from "./settings-form";

export default async function SettingsPage() {
  const { business } = await requireBusiness();

  // Ensure a settings row exists (defaults defined in the Prisma schema).
  const settings = await db.businessSettings.upsert({
    where: { businessId: business.id },
    create: { businessId: business.id },
    update: {},
  });

  const dd = (settings.deliveryDays ?? {}) as Record<string, boolean>;

  const initial: SettingsInitial = {
    name: business.name,
    brandColor: business.brandColor,
    subDiscount: bpsToPercent(settings.subDiscountBps),
    taxRate: bpsToPercent(settings.taxRateBps),
    platformFee: bpsToPercent(settings.platformFeeBps),
    deliveryFee: centsToDollars(settings.deliveryFeeCents),
    processingFee: centsToDollars(settings.processingFeeCents),
    minOrder: centsToDollars(settings.minOrderCents),
    minMeals: settings.minMeals,
    cutoff: settings.cutoff,
    fulfillment: settings.fulfillment as "delivery" | "pickup" | "both",
    deliveryDays: dd,
    pickupLocations: settings.pickupLocations,
  };

  return (
    <Page>
      <Head
        kicker="Settings"
        title="Business Settings"
        sub="Fees, taxes, cut-off, and fulfillment — the rules your storefront and billing run on."
      />
      <SettingsForm initial={initial} />
    </Page>
  );
}

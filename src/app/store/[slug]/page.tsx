import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getStorefrontBusiness, publicStoreUrls } from "@/lib/storefront";
import { cldImage } from "@/lib/cloudinary";
import { storeTitle, storeDescription, storeJsonLd, jsonLdScript, type SeoMeal } from "@/lib/seo";
import { StoreHeader } from "./store-header";
import {
  nextCutoffAt,
  nextDeliveryAfter,
  upcomingDeliveries,
  formatDeliveryLabel,
  DEFAULT_TIMEZONE,
} from "@/lib/cutoff";
import { enabledDeliveryDays, describeDeliveryDays } from "@/lib/delivery-days";
import { CutoffBanner } from "./cutoff-banner";
import { PlanCards } from "./plan-cards";
import { Storefront, type StoreMeal, type StoreReview, type StoreSettings, type StoreZone } from "./storefront";
import { zoneDays } from "@/lib/zones";

export const dynamic = "force-dynamic";

/** Search + link-preview metadata: the kitchen's own words when set, its facts otherwise. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business || !business.settings) return { title: "Storefront not found" };
  const s = business.settings;
  const [mealCount, firstPhoto, urls] = await Promise.all([
    db.meal.count({ where: { businessId: business.id, active: true } }),
    db.meal.findFirst({ where: { businessId: business.id, active: true, imageUrl: { not: null } }, select: { imageUrl: true }, orderBy: { createdAt: "asc" } }),
    publicStoreUrls(business),
  ]);
  const kitchen = { name: business.name, logoUrl: business.logoUrl, tagline: s.storeTagline, description: s.storeDescription, serviceArea: s.serviceArea };
  const title = storeTitle(kitchen);
  const description = storeDescription(kitchen, {
    mealCount,
    deliveryDaysLabel: s.fulfillment === "pickup" ? null : describeDeliveryDays(enabledDeliveryDays((s.deliveryDays ?? {}) as Record<string, boolean>)),
    pickup: s.fulfillment !== "delivery",
  });
  const image = cldImage(firstPhoto?.imageUrl, { w: 1200, h: 630 }) ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: urls.order },
    robots: business.isDemo ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", siteName: business.name, title, description, url: urls.order, images: image ? [{ url: image, width: 1200, height: 630 }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const { slug } = await params;
  const { add } = await searchParams;
  const business = await getStorefrontBusiness(slug);
  if (!business || !business.settings) notFound();
  const s = business.settings;

  const meals = await db.meal.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { createdAt: "asc" },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const plans = await db.plan.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { mealsPerWeek: "asc" },
  });

  // Public stars + comments count APPROVED reviews only — what a diner sees is
  // always something the kitchen has vetted.
  const ratingAgg = await db.mealReview.groupBy({
    by: ["mealId"],
    where: { businessId: business.id, status: "approved" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingByMeal = new Map(ratingAgg.map((r) => [r.mealId, { avg: r._avg.rating ?? 0, count: r._count.rating }]));

  // Most recent approved written reviews, up to 3 per meal, with any kitchen reply.
  const recent = await db.mealReview.findMany({
    where: { businessId: business.id, status: "approved", comment: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { mealId: true, rating: true, comment: true, reply: true, createdAt: true, customer: { select: { name: true } } },
  });
  const reviewsByMeal = new Map<string, StoreReview[]>();
  for (const r of recent) {
    const list = reviewsByMeal.get(r.mealId) ?? [];
    if (list.length >= 3) continue;
    list.push({
      name: (r.customer?.name ?? "Customer").split(" ")[0],
      rating: r.rating,
      comment: r.comment ?? "",
      reply: r.reply,
      date: r.createdAt.toISOString().slice(0, 10),
    });
    reviewsByMeal.set(r.mealId, list);
  }

  const storeMeals: StoreMeal[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    diet: m.diet,
    priceCents: m.priceCents,
    swatch: m.swatch,
    imageUrl: cldImage(m.imageUrl, { w: 700, h: 400 }),
    isAddOn: m.isAddOn,
    upsellPrompt: m.upsellPrompt,
    allergens: m.allergens,
    calories: m.calories,
    proteinG: m.proteinG,
    ratingAvg: ratingByMeal.get(m.id)?.avg ?? 0,
    ratingCount: ratingByMeal.get(m.id)?.count ?? 0,
    reviews: reviewsByMeal.get(m.id) ?? [],
    optionGroups: m.optionGroups
      .filter((g) => g.options.length > 0)
      .map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents, isDefault: o.isDefault })),
      })),
  }));

  // What search engines read: the kitchen as a FoodEstablishment with its menu
  // (prices, nutrition, verified ratings), on its canonical public address.
  const urls = await publicStoreUrls(business);
  const seoMeals: SeoMeal[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    diet: m.diet,
    priceCents: m.priceCents,
    imageUrl: cldImage(m.imageUrl, { w: 1200, h: 800 }),
    calories: m.calories,
    proteinG: m.proteinG,
    carbsG: m.carbsG,
    fatG: m.fatG,
    allergens: m.allergens,
    ratingAvg: ratingByMeal.get(m.id)?.avg ?? 0,
    ratingCount: ratingByMeal.get(m.id)?.count ?? 0,
    reviews: reviewsByMeal.get(m.id) ?? [],
  }));
  const jsonLd = storeJsonLd(
    { name: business.name, logoUrl: business.logoUrl, tagline: s.storeTagline, description: s.storeDescription, serviceArea: s.serviceArea },
    urls.order,
    seoMeals,
    urls.meal,
  );

  // Live order-cut-off countdown, computed in the kitchen's own timezone.
  const tz = s.timezone || DEFAULT_TIMEZONE;
  const cutoffInstant = nextCutoffAt(s.cutoff, tz);

  // Upcoming delivery dates a one-time order can pick from — the kitchen's
  // enabled delivery days, resolved to concrete dates after the next cut-off.
  const enabledDays = enabledDeliveryDays((s.deliveryDays ?? {}) as Record<string, boolean>);
  const deliveryAnchor = cutoffInstant ?? new Date();
  const deliveryDateOptions = upcomingDeliveries(enabledDays, deliveryAnchor, tz, 8, "weekly").map((d) => ({
    value: d.toISOString(),
    label: formatDeliveryLabel(d, tz),
  }));

  // Delivery zones: each gets its own upcoming dates (its days) and fee.
  const zoneRows = await db.deliveryZone.findMany({ where: { businessId: business.id, active: true }, orderBy: { sortOrder: "asc" } });
  const zones: StoreZone[] = zoneRows.map((z) => {
    const zDays = enabledDeliveryDays(zoneDays({ ...z, deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean> }, (s.deliveryDays ?? {}) as Record<string, boolean>));
    return {
      id: z.id,
      name: z.name,
      postalPrefixes: z.postalPrefixes,
      deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean>,
      deliveryFeeCents: z.deliveryFeeCents,
      dateOptions: upcomingDeliveries(zDays, deliveryAnchor, tz, 8, "weekly").map((d) => ({ value: d.toISOString(), label: formatDeliveryLabel(d, tz) })),
      daysLabel: describeDeliveryDays(zDays),
      singleDay: zDays.length === 1,
    };
  });

  const settings: StoreSettings = {
    subDiscountBps: s.subDiscountBps,
    taxRateBps: s.taxRateBps,
    deliveryFeeCents: s.deliveryFeeCents,
    processingFeeCents: s.processingFeeCents,
    minOrderCents: s.minOrderCents,
    minMeals: s.minMeals,
    fulfillment: s.fulfillment,
    pickupLocations: s.pickupLocations,
    deliveryDateOptions,
    deliveryDaysLabel: describeDeliveryDays(enabledDays),
    singleDeliveryDay: enabledDays.length === 1,
    zones,
  };

  const cutoffISO = cutoffInstant?.toISOString() ?? null;
  const deliveryInstant = cutoffInstant
    ? nextDeliveryAfter((s.deliveryDays ?? {}) as Record<string, boolean>, cutoffInstant, tz)
    : null;
  const deliveryLabel = deliveryInstant ? formatDeliveryLabel(deliveryInstant, tz) : null;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--paper)", "--pine": business.brandColor } as React.CSSProperties}
    >
      {cutoffISO && (
        <CutoffBanner
          cutoffISO={cutoffISO}
          cutoffLabel={s.cutoff}
          deliveryLabel={deliveryLabel}
          brandColor={business.brandColor}
        />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <StoreHeader slug={slug} name={business.name} logoUrl={business.logoUrl} tagline={s.storeTagline} />

      <main className="max-w-6xl mx-auto px-6 py-8 fade">
        <div className="mb-7">
          <h1 className="disp text-[30px] leading-none font-medium" style={{ color: "var(--ink)" }}>
            Order Fresh Meals{s.serviceArea ? <span style={{ color: "var(--ink-soft)" }}> · {s.serviceArea}</span> : null}
          </h1>
          <p className="text-[13.5px] mt-2.5" style={{ color: "var(--ink-soft)" }}>
            {s.storeTagline || "Browse the menu, build your order, and subscribe to save every week."}
          </p>
          {s.cateringEnabled && (
            <Link href={`/store/${slug}/catering`} className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-medium" style={{ color: "var(--pine)" }}>
              Feeding a group? Catering &amp; large orders →
            </Link>
          )}
        </div>

        {plans.length > 0 && (
          <PlanCards
            slug={slug}
            plans={plans.map((p) => ({
              id: p.id,
              name: p.name,
              mealsPerWeek: p.mealsPerWeek,
              perMealPriceCents: p.perMealPriceCents,
            }))}
            subDiscountPct={Math.round(s.subDiscountBps / 100)}
            deliveryDays={enabledDeliveryDays((s.deliveryDays ?? {}) as Record<string, boolean>)}
          />
        )}

        <Storefront slug={slug} businessName={business.name} meals={storeMeals} settings={settings} initialAdd={add} />
      </main>
    </div>
  );
}

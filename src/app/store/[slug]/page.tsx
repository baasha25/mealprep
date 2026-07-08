import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaf } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { Storefront, type StoreMeal, type StoreSettings } from "./storefront";

export const dynamic = "force-dynamic";

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business || !business.settings) notFound();
  const s = business.settings;

  const meals = await db.meal.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { createdAt: "asc" },
  });

  const ratingAgg = await db.mealReview.groupBy({
    by: ["mealId"],
    where: { businessId: business.id },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingByMeal = new Map(ratingAgg.map((r) => [r.mealId, { avg: r._avg.rating ?? 0, count: r._count.rating }]));

  const storeMeals: StoreMeal[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    diet: m.diet,
    priceCents: m.priceCents,
    swatch: m.swatch,
    allergens: m.allergens,
    calories: m.calories,
    proteinG: m.proteinG,
    ratingAvg: ratingByMeal.get(m.id)?.avg ?? 0,
    ratingCount: ratingByMeal.get(m.id)?.count ?? 0,
  }));

  const settings: StoreSettings = {
    subDiscountBps: s.subDiscountBps,
    taxRateBps: s.taxRateBps,
    deliveryFeeCents: s.deliveryFeeCents,
    processingFeeCents: s.processingFeeCents,
    minOrderCents: s.minOrderCents,
    fulfillment: s.fulfillment,
    pickupLocations: s.pickupLocations,
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--paper)", "--pine": business.brandColor } as React.CSSProperties}
    >
      <header
        className="border-b"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
              <Leaf size={17} color="#f4f2ec" />
            </div>
            <div>
              <div className="disp text-[18px] font-medium leading-none" style={{ color: "var(--ink)" }}>
                {business.name}
              </div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                Fresh meals, made to order
              </div>
            </div>
          </div>
          <Link href={`/store/${slug}/account`} className="text-[13px] font-medium" style={{ color: "var(--pine)" }}>
            My account →
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 fade">
        <div className="mb-7">
          <h1 className="disp text-[30px] leading-none font-medium" style={{ color: "var(--ink)" }}>
            Order Fresh Meals
          </h1>
          <p className="text-[13.5px] mt-2.5" style={{ color: "var(--ink-soft)" }}>
            Browse the menu, build your order, and subscribe to save every week.
          </p>
        </div>
        <Storefront slug={slug} businessName={business.name} meals={storeMeals} settings={settings} />
      </main>
    </div>
  );
}

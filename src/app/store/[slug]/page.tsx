import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaf } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { formatCents } from "@/lib/money";
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

  const plans = await db.plan.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { mealsPerWeek: "asc" },
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

        {plans.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Subscription plans
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {plans.map((p) => (
                <div key={p.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{p.name}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {p.mealsPerWeek} meals/week · {formatCents(p.perMealPriceCents)}/meal
                  </div>
                  <div className="mt-2">
                    <span className="disp text-[20px] font-medium" style={{ color: "var(--pine)" }}>
                      {formatCents(p.mealsPerWeek * p.perMealPriceCents)}
                    </span>
                    <span className="text-[12px]" style={{ color: "var(--muted)" }}> /week</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] mt-2.5" style={{ color: "var(--muted)" }}>
              Turn on <span className="font-medium" style={{ color: "var(--pine)" }}>Subscribe &amp; save</span> at checkout to save {Math.round(s.subDiscountBps / 100)}% every week.
            </p>
          </div>
        )}

        <Storefront slug={slug} businessName={business.name} meals={storeMeals} settings={settings} />
      </main>
    </div>
  );
}

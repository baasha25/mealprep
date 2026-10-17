import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Leaf, Plus, Star, Wheat, Milk, Nut, Fish, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontBusiness, publicStoreUrls } from "@/lib/storefront";
import { cldImage } from "@/lib/cloudinary";
import { formatCents } from "@/lib/money";
import { mealTitle, mealDescription, mealProductJsonLd, jsonLdScript, type SeoMeal } from "@/lib/seo";
import { StoreHeader } from "../../store-header";

export const dynamic = "force-dynamic";

const ALLERGEN_ICON: Record<string, LucideIcon> = { gluten: Wheat, dairy: Milk, nuts: Nut, fish: Fish };

const card = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(31,30,26,.03)",
} as const;

/** One meal, fully loaded for its public page (tenant-scoped, active only). */
async function loadMeal(businessId: string, mealId: string): Promise<(SeoMeal & { optionCount: number; swatch: string }) | null> {
  const m = await db.meal.findFirst({
    where: { id: mealId, businessId, active: true },
    include: { optionGroups: { select: { id: true } } },
  });
  if (!m) return null;
  const [agg, reviews] = await Promise.all([
    db.mealReview.aggregate({ where: { mealId: m.id, businessId, status: "approved" }, _avg: { rating: true }, _count: { rating: true } }),
    db.mealReview.findMany({
      where: { mealId: m.id, businessId, status: "approved", comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { rating: true, comment: true, reply: true, createdAt: true, customer: { select: { name: true } } },
    }),
  ]);
  return {
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
    ratingAvg: agg._avg.rating ?? 0,
    ratingCount: agg._count.rating,
    reviews: reviews.map((r) => ({
      name: (r.customer?.name ?? "Customer").split(" ")[0],
      rating: r.rating,
      comment: r.comment ?? "",
      reply: r.reply,
      date: r.createdAt.toISOString().slice(0, 10),
    })),
    optionCount: m.optionGroups.length,
    swatch: m.swatch,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; mealId: string }> }): Promise<Metadata> {
  const { slug, mealId } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business || !business.settings) return { title: "Not found" };
  const meal = await loadMeal(business.id, mealId);
  if (!meal) return { title: "Not found" };
  const s = business.settings;
  const kitchen = { name: business.name, serviceArea: s.serviceArea };
  const urls = await publicStoreUrls(business);
  const title = mealTitle(meal, kitchen);
  const description = mealDescription(meal, kitchen);
  const image = cldImage(meal.imageUrl, { w: 1200, h: 630 }) ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: urls.meal(meal.id) },
    robots: business.isDemo ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", siteName: business.name, title, description, url: urls.meal(meal.id), images: image ? [{ url: image, width: 1200, height: 630 }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function MealPage({ params }: { params: Promise<{ slug: string; mealId: string }> }) {
  const { slug, mealId } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business || !business.settings) notFound();
  const meal = await loadMeal(business.id, mealId);
  if (!meal) notFound();
  const s = business.settings;
  const urls = await publicStoreUrls(business);

  // Three other meals from the same menu, so a visitor from search sees the range.
  const more = await db.meal.findMany({
    where: { businessId: business.id, active: true, id: { not: meal.id }, isAddOn: false },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true, name: true, priceCents: true, imageUrl: true, swatch: true, diet: true },
  });

  const jsonLd = mealProductJsonLd(meal, { name: business.name, serviceArea: s.serviceArea }, urls.meal(meal.id));
  const addHref = `/store/${slug}?add=${meal.id}`;
  const macros: [string, string][] = [
    ["Calories", String(meal.calories)],
    ["Protein", `${meal.proteinG} g`],
    ["Carbs", `${meal.carbsG} g`],
    ["Fat", `${meal.fatG} g`],
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business.brandColor } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <StoreHeader slug={slug} name={business.name} logoUrl={business.logoUrl} tagline={s.storeTagline} />

      <main className="max-w-6xl mx-auto px-6 py-8 fade">
        <Link href={`/store/${slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium mb-5" style={{ color: "var(--pine)" }}>
          <ArrowLeft size={14} /> Back to the menu
        </Link>

        <article className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
          <div className="rounded-xl border overflow-hidden" style={card}>
            <div className={`${meal.imageUrl ? "aspect-[3/2]" : "h-56"} relative grid place-items-center`} style={{ background: `${meal.swatch}10` }}>
              {meal.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meal.imageUrl} alt={meal.name} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <Leaf size={40} style={{ color: meal.swatch, opacity: 0.5 }} />
              )}
              {meal.diet && (
                <span className="absolute top-3 left-3 text-[11px] px-2 py-0.5 rounded shadow-sm" style={{ background: "var(--surface)", color: meal.swatch, border: `1px solid ${meal.swatch}33` }}>
                  {meal.diet}
                </span>
              )}
            </div>
          </div>

          <div>
            <h1 className="disp text-[30px] leading-tight font-medium" style={{ color: "var(--ink)" }}>
              {meal.name}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
              <span className="disp text-[22px] font-medium" style={{ color: "var(--ink)" }}>
                {formatCents(meal.priceCents)}
              </span>
              {meal.ratingCount > 0 && (
                <span className="flex items-center gap-1" style={{ color: "#c98a2b" }}>
                  <Star size={13} fill="#e0a53f" style={{ color: "#e0a53f" }} />
                  {meal.ratingAvg.toFixed(1)}
                  <span style={{ color: "var(--muted)" }}>
                    ({meal.ratingCount} verified {meal.ratingCount === 1 ? "review" : "reviews"})
                  </span>
                </span>
              )}
            </div>
            {meal.description && (
              <p className="text-[14.5px] mt-4 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                {meal.description}
              </p>
            )}

            <dl className="grid grid-cols-4 gap-2 mt-5">
              {macros.map(([k, v]) => (
                <div key={k} className="rounded-lg border px-3 py-2.5" style={card}>
                  <dt className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{k}</dt>
                  <dd className="text-[15px] font-semibold mt-0.5" style={{ color: "var(--ink)" }}>{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 text-[12.5px]" style={{ color: "var(--muted)" }}>
              {meal.allergens.length ? (
                <span className="inline-flex items-center gap-2">
                  Contains:
                  {meal.allergens.map((a) => {
                    const I = ALLERGEN_ICON[a];
                    return (
                      <span key={a} className="inline-flex items-center gap-1 capitalize" style={{ color: "var(--ink)" }}>
                        {I && <I size={13} color="var(--clay)" strokeWidth={2.4} />} {a}
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span>No listed allergens. Prepared in a kitchen that handles common allergens.</span>
              )}
            </div>

            <Link
              href={addHref}
              className="mt-6 inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-[15px] font-medium"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              <Plus size={16} /> {meal.optionCount ? "Customize & add to order" : "Add to order"}
            </Link>
            <p className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
              Order one-time or as part of a weekly plan from {business.name}
              {s.serviceArea ? ` · ${s.serviceArea}` : ""}.
            </p>
          </div>
        </article>

        {meal.reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              What customers say
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {meal.reviews.map((r, i) => (
                <div key={i} className="rounded-xl border p-4" style={card}>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: "#c98a2b", letterSpacing: 1 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{r.name}</span>
                    <span className="px-1.5 py-px rounded" style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)", color: "var(--pine)", fontSize: 10 }}>Verified order</span>
                    <span className="ml-auto" style={{ color: "var(--muted)" }}>{r.date}</span>
                  </div>
                  <p className="text-[13px] mt-2 leading-snug" style={{ color: "var(--ink-soft)" }}>{r.comment}</p>
                  {r.reply && (
                    <p className="text-[12px] mt-2 pl-2.5 leading-snug" style={{ color: "var(--muted)", borderLeft: "2px solid var(--line)" }}>
                      <span className="font-medium" style={{ color: "var(--ink)" }}>Kitchen reply:</span> {r.reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {more.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[17px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              More from {business.name}
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {more.map((m) => {
                const img = cldImage(m.imageUrl, { w: 700, h: 400 });
                return (
                  <Link key={m.id} href={`/store/${slug}/meal/${m.id}`} className="rounded-xl border overflow-hidden flex flex-col" style={card} prefetch={false}>
                    <div className={`${img ? "h-36" : "h-20"} relative grid place-items-center`} style={{ background: `${m.swatch}10` }}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={m.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <Leaf size={22} style={{ color: m.swatch, opacity: 0.5 }} />
                      )}
                    </div>
                    <div className="p-3.5 flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>{m.name}</span>
                      <span className="text-[13.5px] shrink-0" style={{ color: "var(--ink-soft)" }}>{formatCents(m.priceCents)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

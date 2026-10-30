import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { minEventDateISO } from "@/lib/catering";
import { StoreHeader } from "../store-header";
import { CateringForm } from "./catering-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business?.settings?.cateringEnabled) return { title: "Catering" };
  const area = business.settings.serviceArea?.trim();
  return {
    title: `Catering & large orders · ${business.name}`,
    description: `${business.name} caters offices and events${area ? ` in ${area}` : ""}: pick a date and headcount, choose meals or describe what you need, and get a quote to approve before anything is charged.`,
    robots: business.isDemo ? { index: false, follow: false } : undefined,
  };
}

/** Public catering request page: date, headcount, meals (or a description) → request. */
export default async function CateringPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business?.settings) notFound();
  const s = business.settings;
  if (!s.cateringEnabled) notFound();

  const meals = await db.meal.findMany({
    where: { businessId: business.id, active: true },
    orderBy: [{ perGuest: "desc" }, { isAddOn: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, priceCents: true, diet: true, isAddOn: true, perGuest: true },
  });
  const tz = s.timezone || DEFAULT_TIMEZONE;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business.brandColor } as React.CSSProperties}>
      <StoreHeader slug={slug} name={business.name} logoUrl={business.logoUrl} tagline={s.storeTagline} />
      <main className="max-w-4xl mx-auto px-6 py-8 fade">
        <Link href={`/store/${slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium mb-5" style={{ color: "var(--pine)" }}>
          <ArrowLeft size={14} /> Back to the menu
        </Link>
        <h1 className="disp text-[30px] leading-none font-medium" style={{ color: "var(--ink)" }}>
          Catering &amp; large orders
        </h1>
        <p className="text-[14px] mt-3 max-w-2xl leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {s.cateringIntro?.trim() || `Boxed meals and trays for offices, teams and events. Tell us the date and how many people, pick from the menu or describe what you need, and ${business.name} sends you a quote to approve. Nothing is charged until you say yes.`}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
          <span>Minimum {s.cateringMinMeals} meals</span>
          <span>{s.cateringLeadDays} day{s.cateringLeadDays === 1 ? "" : "s"}&apos; notice</span>
          <span>{s.fulfillment === "pickup" ? "Pickup" : s.fulfillment === "delivery" ? "Delivery" : "Delivery or pickup"}</span>
        </div>

        <CateringForm
          slug={slug}
          meals={meals}
          minDate={minEventDateISO(s.cateringLeadDays, tz)}
          minMeals={s.cateringMinMeals}
          fulfillment={s.fulfillment as "delivery" | "pickup" | "both"}
          pickupLocations={s.pickupLocations}
        />
      </main>
    </div>
  );
}

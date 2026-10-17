import { cache } from "react";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { parseDomainMap, activeStorefrontOrigin, storefrontUrls, mealPageUrl } from "@/lib/custom-domains";

/**
 * Resolve the kitchen whose public storefront is being viewed, by its slug.
 * Each kitchen has its own storefront at /store/<slug>. Returns null if no
 * kitchen owns that slug. Memoized per request so generateMetadata and the
 * page body share one query.
 */
export const getStorefrontBusiness = cache(async (slug: string) => {
  if (!slug) return null;
  return db.business.findUnique({
    where: { slug },
    include: { settings: true },
  });
});

/**
 * The public, canonical addresses of a storefront: on the kitchen's own domain
 * when that is live (CUSTOM_DOMAINS), otherwise under <app>/store/<slug>.
 * Used for <link rel=canonical>, JSON-LD urls and the per-kitchen sitemap.
 */
export async function publicStoreUrls(business: { slug: string | null; customDomain: string | null }) {
  const slug = business.slug ?? "";
  const base = await appUrl();
  const customOrigin = activeStorefrontOrigin(business.customDomain, slug, parseDomainMap(process.env.CUSTOM_DOMAINS));
  const urls = storefrontUrls(base, slug, customOrigin);
  return { ...urls, base, customOrigin, meal: (mealId: string) => mealPageUrl(base, slug, customOrigin, mealId) };
}

/**
 * The slug the bare /store URL redirects to. Public/cold traffic must never land
 * on a random or half-set-up tenant, so prefer an explicitly designated showcase
 * kitchen (SHOWCASE_STOREFRONT_SLUG in env) when set and valid; only fall back to
 * the earliest real kitchen for back-compat.
 */
export async function getFirstStorefrontSlug(): Promise<string | null> {
  const showcase = process.env.SHOWCASE_STOREFRONT_SLUG?.trim();
  if (showcase) {
    const pick = await db.business.findFirst({
      where: { slug: showcase, isDemo: false },
      select: { slug: true },
    });
    if (pick?.slug) return pick.slug;
  }
  const business = await db.business.findFirst({
    where: { slug: { not: null }, isDemo: false }, // never land the public /store on a demo tenant
    orderBy: { createdAt: "asc" },
    select: { slug: true },
  });
  return business?.slug ?? null;
}

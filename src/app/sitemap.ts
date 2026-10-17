import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { parseDomainMap, activeStorefrontOrigin } from "@/lib/custom-domains";

export const dynamic = "force-dynamic";

/**
 * prepflow.ca/sitemap.xml — the marketing pages plus every real kitchen's
 * storefront and meal pages that live under /store/<slug>. Kitchens whose own
 * domain is live are left out here: their domain serves its own sitemap, and
 * cross-domain entries are ignored by search engines anyway.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await appUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, priority: 1 },
    { url: `${base}/audit`, lastModified: now, priority: 0.7 },
    { url: `${base}/calculator`, lastModified: now, priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, priority: 0.2 },
  ];

  const map = parseDomainMap(process.env.CUSTOM_DOMAINS);
  const kitchens = await db.business.findMany({
    where: { slug: { not: null }, isDemo: false, meals: { some: { active: true } } },
    select: {
      slug: true,
      customDomain: true,
      updatedAt: true,
      meals: { where: { active: true }, select: { id: true, updatedAt: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const k of kitchens) {
    const slug = k.slug!;
    if (activeStorefrontOrigin(k.customDomain, slug, map)) continue; // served from its own domain
    const root = `${base}/store/${slug}`;
    const newest = k.meals.reduce<Date>((d, m) => (m.updatedAt > d ? m.updatedAt : d), k.updatedAt);
    entries.push({ url: root, lastModified: newest, priority: 0.9 });
    for (const m of k.meals) entries.push({ url: `${root}/meal/${m.id}`, lastModified: m.updatedAt, priority: 0.6 });
  }
  return entries;
}

import { db } from "@/lib/db";
import { getStorefrontBusiness, publicStoreUrls } from "@/lib/storefront";
import { sitemapXml } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * One kitchen's sitemap: its menu page plus every active meal page, on the
 * kitchen's own domain when that is live. Served at /store/<slug>/sitemap.xml
 * and, via the custom-domain rewrite, at order.theirbrand.com/sitemap.xml.
 * Demo tenants get an empty set (they are noindex everywhere).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const business = await getStorefrontBusiness(slug);
  if (!business) return new Response("Not found", { status: 404 });

  const urls = await publicStoreUrls(business);
  const entries: { loc: string; lastmod?: string | null; priority?: number }[] = [];
  if (!business.isDemo) {
    const meals = await db.meal.findMany({
      where: { businessId: business.id, active: true },
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });
    const newest = meals.reduce<Date | null>((d, m) => (!d || m.updatedAt > d ? m.updatedAt : d), null);
    entries.push({ loc: urls.order, lastmod: (newest ?? business.updatedAt).toISOString(), priority: 1 });
    for (const m of meals) entries.push({ loc: urls.meal(m.id), lastmod: m.updatedAt.toISOString(), priority: 0.8 });
  }

  return new Response(sitemapXml(entries), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

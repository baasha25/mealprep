import { getStorefrontBusiness, publicStoreUrls } from "@/lib/storefront";
import { storeRobotsTxt } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * robots.txt for a storefront on its own domain (reached through the
 * custom-domain rewrite). Lets crawlers index the menu and meal pages, keeps
 * them out of account/checkout pages, and points at the kitchen's sitemap.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const business = await getStorefrontBusiness(slug);
  if (!business) return new Response("Not found", { status: 404 });
  const urls = await publicStoreUrls(business);
  return new Response(storeRobotsTxt(urls.sitemap, !business.isDemo), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

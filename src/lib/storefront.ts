import { db } from "@/lib/db";

/**
 * Resolve the kitchen whose public storefront is being viewed, by its slug.
 * Each kitchen has its own storefront at /store/<slug>. Returns null if no
 * kitchen owns that slug.
 */
export async function getStorefrontBusiness(slug: string) {
  if (!slug) return null;
  return db.business.findUnique({
    where: { slug },
    include: { settings: true },
  });
}

/**
 * The slug of the earliest kitchen — used only to redirect the bare /store
 * URL to a concrete storefront (back-compat / single-tenant demo).
 */
export async function getFirstStorefrontSlug(): Promise<string | null> {
  const business = await db.business.findFirst({
    where: { slug: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { slug: true },
  });
  return business?.slug ?? null;
}

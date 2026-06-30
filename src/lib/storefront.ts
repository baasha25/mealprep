import { db } from "@/lib/db";

/**
 * Resolve the business whose public storefront is being viewed.
 *
 * Today: the first/only business (dev, single-tenant storefront). Later this
 * keys off a subdomain or slug so each kitchen has its own storefront URL.
 */
export async function getStorefrontBusiness() {
  return db.business.findFirst({
    orderBy: { createdAt: "asc" },
    include: { settings: true },
  });
}

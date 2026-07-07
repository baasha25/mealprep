import { notFound, redirect } from "next/navigation";
import { getFirstStorefrontSlug } from "@/lib/storefront";

export const dynamic = "force-dynamic";

/**
 * Bare /store has no kitchen context in a multi-tenant world. Redirect to the
 * first kitchen's storefront so legacy /store links keep working; 404 if there
 * are no kitchens yet.
 */
export default async function StoreIndex() {
  const slug = await getFirstStorefrontSlug();
  if (!slug) notFound();
  redirect(`/store/${slug}`);
}

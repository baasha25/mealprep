import { NextResponse } from "next/server";
import { getStorefrontBusiness } from "@/lib/storefront";

export const dynamic = "force-dynamic";

/**
 * One web-app manifest per kitchen, so "Add to Home Screen" installs the
 * kitchen's own storefront with its name and colour: the honest answer to
 * "do you have an app?" without building one.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business) return new NextResponse("Not found", { status: 404 });
  const manifest = {
    name: business.name,
    short_name: business.name.length > 12 ? business.name.split(" ")[0] : business.name,
    description: business.settings?.storeDescription ?? `Order from ${business.name}`,
    start_url: `/store/${slug}?source=pwa`,
    scope: `/store/${slug}`,
    display: "standalone",
    background_color: "#f4f2ec",
    theme_color: business.brandColor || "#2f4536",
    icons: [
      { src: "/icons/leaf-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/leaf-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/leaf-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}

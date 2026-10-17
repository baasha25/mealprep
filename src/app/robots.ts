import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * prepflow.ca/robots.txt — index the marketing site and storefront menus; keep
 * crawlers out of the owner dashboard, admin, APIs, auth and account pages.
 * (A kitchen's own domain gets its own robots via /store/<slug>/robots.txt.)
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await appUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/api/", "/onboarding", "/demo", "/sign-in", "/sign-up", "/account", "/partner", "/store/*/account", "/store/*/success", "/store/*/subscribed"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

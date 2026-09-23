import { headers } from "next/headers";
import { requireBusiness } from "@/lib/auth";
import { Page, Head } from "@/components/ui";
import { ShareLinks, type ShareLink } from "./share-links";
import { parseDomainMap, activeStorefrontOrigin, storefrontUrls } from "@/lib/custom-domains";

export const dynamic = "force-dynamic";

export default async function SharePage() {
  const { business } = await requireBusiness();

  // Build absolute URLs from the current host so the links work in any environment.
  const h = await headers();
  const host = h.get("host") ?? "mealprepsoftware.netlify.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const slug = business.slug ?? "";

  // Once a kitchen's own domain is live (Settings → Brand + concierge activation),
  // every link and button here points at order.theirbrand.com instead of /store/<slug>.
  const customOrigin = activeStorefrontOrigin(business.customDomain, slug, parseDomainMap(process.env.CUSTOM_DOMAINS));
  const urls = storefrontUrls(base, slug, customOrigin);
  const domainStatus: "active" | "pending" | null = customOrigin ? "active" : business.customDomain ? "pending" : null;

  const links: ShareLink[] = [
    {
      key: "order",
      label: "Order / Storefront",
      description: "Your menu and checkout. The main link to share for taking orders.",
      url: urls.order,
      buttonText: "Order Now",
    },
    {
      key: "signin",
      label: "Customer login & account",
      description: "Returning customers sign in to manage their subscription and loyalty.",
      url: urls.account,
      buttonText: "My Account",
    },
    {
      key: "signup",
      label: "Customer sign-up",
      description: "New customers create an account (opens straight to sign-up).",
      url: urls.signup,
      buttonText: "Sign Up",
    },
  ];

  return (
    <Page>
      <Head
        kicker="Grow"
        title="Share links"
        sub="Copy these onto your own website or socials — no separate customer site to build."
      />
      {slug ? (
        <ShareLinks links={links} brandColor={business.brandColor} domainStatus={domainStatus} customDomain={business.customDomain} />
      ) : (
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          Your storefront link isn&apos;t ready yet. Finish setup in Settings and it&apos;ll appear here.
        </p>
      )}
    </Page>
  );
}

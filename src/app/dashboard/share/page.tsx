import { headers } from "next/headers";
import { requireBusiness } from "@/lib/auth";
import { Page, Head } from "@/components/ui";
import { ShareLinks, type ShareLink } from "./share-links";

export const dynamic = "force-dynamic";

export default async function SharePage() {
  const { business } = await requireBusiness();

  // Build absolute URLs from the current host so the links work in any environment.
  const h = await headers();
  const host = h.get("host") ?? "mealprepsoftware.netlify.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const slug = business.slug ?? "";

  const links: ShareLink[] = [
    {
      key: "order",
      label: "Order / Storefront",
      description: "Your menu and checkout. The main link to share for taking orders.",
      url: `${base}/store/${slug}`,
      buttonText: "Order Now",
    },
    {
      key: "signin",
      label: "Customer login & account",
      description: "Returning customers sign in to manage their subscription and loyalty.",
      url: `${base}/store/${slug}/account`,
      buttonText: "My Account",
    },
    {
      key: "signup",
      label: "Customer sign-up",
      description: "New customers create an account (opens straight to sign-up).",
      url: `${base}/store/${slug}/account?signup`,
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
        <ShareLinks links={links} brandColor={business.brandColor} />
      ) : (
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          Your storefront link isn&apos;t ready yet. Finish setup in Settings and it&apos;ll appear here.
        </p>
      )}
    </Page>
  );
}

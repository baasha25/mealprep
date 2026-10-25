import Link from "next/link";
import { Leaf, Check, AlertTriangle } from "lucide-react";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";
import { ensureSubscriptionFromCheckout } from "@/lib/billing";

export const dynamic = "force-dynamic";
// Personal pages: never in search results.
export const metadata = { robots: { index: false, follow: false } };

export default async function SubscribedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string; demo?: string }>;
}) {
  const { slug } = await params;
  const { session_id, demo } = await searchParams;
  const business = await getStorefrontBusiness(slug);

  let ok = false;
  let planName = "";
  let isDemo = false;

  // Sales sandbox: the plan was created directly (no Stripe) — confirm from the DB.
  if (business?.isDemo && demo === "1") {
    const { db } = await import("@/lib/db");
    const sub = await db.subscription.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "desc" }, include: { plan: { select: { name: true } } } });
    if (sub) {
      ok = true;
      isDemo = true;
      planName = sub.plan.name;
    }
  } else if (business && STRIPE_ENABLED && session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.status === "complete") {
        const result = await ensureSubscriptionFromCheckout(session);
        if (result) {
          ok = true;
          planName = result.planName;
        }
      }
    } catch {
      ok = false;
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business?.brandColor ?? "#2f4536" } as React.CSSProperties}>
      <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-2.5">
          <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
            <Leaf size={17} color="#f4f2ec" />
          </div>
          <div className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>{business?.name ?? "PrepFlow"}</div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-20 text-center fade">
        {ok ? (
          <>
            <div className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5" style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}>
              <Check size={26} style={{ color: "var(--pine)" }} />
            </div>
            <h1 className="disp text-[28px] font-medium" style={{ color: "var(--ink)" }}>You&apos;re subscribed 🎉</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
              Your {planName} subscription is active. Pick your meals and manage everything from your account.
            </p>
            {isDemo && (
              <p className="text-[12.5px] mt-3 px-3 py-2 rounded-lg inline-block" style={{ background: "color-mix(in srgb, var(--pine) 9%, transparent)", color: "var(--pine)" }}>
                Demo kitchen: no card was charged. In a real kitchen this step is Stripe checkout.
              </p>
            )}
            <Link href={`/store/${slug}/account`} className="inline-block mt-7 px-5 py-2.5 rounded-lg text-[14px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
              Go to my account
            </Link>
          </>
        ) : (
          <>
            <div className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5" style={{ background: "color-mix(in srgb, var(--clay) 12%, transparent)" }}>
              <AlertTriangle size={24} style={{ color: "var(--clay)" }} />
            </div>
            <h1 className="disp text-[24px] font-medium" style={{ color: "var(--ink)" }}>Subscription not confirmed</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
              We couldn&apos;t confirm your subscription. If you were charged, contact the kitchen — otherwise please try again.
            </p>
            <Link href={`/store/${slug}`} className="inline-block mt-7 px-5 py-2.5 rounded-lg text-[14px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
              Back to the store
            </Link>
          </>
        )}
      </main>
    </div>
  );
}

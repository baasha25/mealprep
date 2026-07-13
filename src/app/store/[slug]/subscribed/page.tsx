import Link from "next/link";
import { Leaf, Check, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";
import { referralCodeFrom } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export default async function SubscribedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;
  const business = await getStorefrontBusiness(slug);

  let ok = false;
  let planName = "";

  if (business && STRIPE_ENABLED && session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const custId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      const email = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
      const name = session.customer_details?.name ?? email.split("@")[0] ?? "there";
      const planId = session.metadata?.planId;
      const frequency = (session.metadata?.frequency === "biweekly" ? "biweekly" : "weekly") as
        | "weekly"
        | "biweekly";

      if (session.status === "complete" && subId && email && planId) {
        const plan = await db.plan.findFirst({ where: { id: planId, businessId: business.id } });
        planName = plan?.name ?? "your plan";

        // Idempotent — only create the subscription once per Stripe subscription.
        const already = await db.subscription.findFirst({ where: { stripeSubscriptionId: subId } });
        if (!already && plan) {
          const customer = await db.customer.upsert({
            where: { businessId_email: { businessId: business.id, email } },
            create: {
              businessId: business.id,
              name,
              email,
              stripeCustomerId: custId,
              referralCode: referralCodeFrom(name, Date.now() % 100000),
            },
            update: { stripeCustomerId: custId },
          });
          const firstDelivery = new Date(Date.now() + 5 * 86_400_000);
          await db.subscription.create({
            data: {
              businessId: business.id,
              customerId: customer.id,
              planId: plan.id,
              status: "active",
              frequency,
              nextDeliveryDate: firstDelivery,
              stripeSubscriptionId: subId,
            },
          });
        }
        ok = true;
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

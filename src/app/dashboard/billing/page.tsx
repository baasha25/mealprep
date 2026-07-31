import { CreditCard, CheckCircle2, Clock, AlertTriangle, Gift } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Card, CardTitle } from "@/components/ui";
import { TIERS, type TierKey } from "@/lib/tiers";
import { trialStatus } from "@/lib/trial";
import { kitchenAccess, KITCHEN_BILLING_ENABLED, type BillingStatus } from "@/lib/kitchen-billing";
import { PlanCards, ManageBillingButton } from "./billing-buttons";
import { confirmCheckout } from "./actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; session_id?: string; canceled?: string }>;
}) {
  const { business } = await requireOwner();
  const sp = await searchParams;

  // Fast-path: just returned from Checkout — reflect the new subscription now,
  // then re-read (the cached auth context still holds the pre-checkout row).
  let fresh = business;
  if (sp.subscribed === "1" && sp.session_id) {
    await confirmCheckout(sp.session_id);
    fresh = (await db.business.findUnique({ where: { id: business.id } })) ?? business;
  }

  const access = kitchenAccess({
    trialEndsAt: fresh.trialEndsAt,
    billingStatus: fresh.billingStatus as BillingStatus,
    billingComped: fresh.billingComped,
    billingSubscriptionId: fresh.billingSubscriptionId,
  });
  const trial = trialStatus(fresh.trialEndsAt);
  const tier = fresh.tier as TierKey;
  const planName = TIERS[tier].name;

  const statusCard = (() => {
    switch (access.state) {
      case "comped":
        return { icon: <Gift size={18} />, fg: "var(--pine)", title: "Founding customer", body: `${business.name} has complimentary access — you won't be charged.` };
      case "subscribed":
        return { icon: <CheckCircle2 size={18} />, fg: "var(--pine)", title: `Subscribed — ${planName}`, body: `$${Math.round(TIERS[tier].priceCents / 100)}/mo, billed monthly. Thanks for being on PrepFlow.` };
      case "past_due":
        return { icon: <AlertTriangle size={18} />, fg: "var(--clay)", title: "Payment past due", body: "Your last charge didn't go through. Update your card to avoid losing access — we'll retry automatically." };
      case "trialing":
        return { icon: <Clock size={18} />, fg: "var(--pine)", title: `${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left in your free trial`, body: "Full access to everything. Pick a plan below before your trial ends to keep things running." };
      case "locked":
        return { icon: <AlertTriangle size={18} />, fg: "var(--clay)", title: "Your free trial has ended", body: "Choose a plan to reactivate your dashboard. Your storefront and existing orders are still live." };
    }
  })();

  return (
    <Page>
      <Head kicker="Account" title="Billing & plan" sub="Your PrepFlow subscription — the software fee, separate from the payments your customers make to you." />

      {sp.subscribed === "1" && (
        <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--pine) 25%, transparent)" }}>
          <CheckCircle2 size={17} style={{ color: "var(--pine)" }} />
          <span className="text-[13.5px]" style={{ color: "var(--ink)" }}>You&apos;re subscribed — welcome aboard. It may take a moment to reflect everywhere.</span>
        </div>
      )}

      {/* Current status */}
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-lg shrink-0" style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)", color: statusCard.fg }}>
            {statusCard.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{statusCard.title}</div>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-soft)" }}>{statusCard.body}</p>
          </div>
          {access.subscribed && business.billingCustomerId && (
            <div className="shrink-0"><ManageBillingButton /></div>
          )}
        </div>
      </Card>

      {/* Plans */}
      {!KITCHEN_BILLING_ENABLED ? (
        <Card>
          <CardTitle icon={<CreditCard size={15} />} title="Plans" />
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Online billing isn&apos;t switched on in this environment yet. Your plan is <strong>{planName}</strong>.
          </p>
        </Card>
      ) : access.state === "comped" ? (
        <Card>
          <CardTitle icon={<CreditCard size={15} />} title="Plans" />
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            You&apos;re on complimentary access. When you&apos;re ready to move to a paid plan, we&apos;ll set it up for you.
          </p>
        </Card>
      ) : (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--muted)" }}>
            {access.subscribed ? "Change plan" : "Choose a plan"}
          </div>
          <PlanCards currentTier={tier} subscribed={access.subscribed} />
          <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>
            Prices are the monthly software fee. On top is a small per-order platform fee ({TIERS[tier].platformFeeBps / 100}% on your plan) and Stripe&apos;s processing at cost. Cancel anytime from Manage billing.
          </p>
        </div>
      )}
    </Page>
  );
}

import { Landmark, Check, AlertTriangle } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { Page, Head } from "@/components/ui";
import { ConnectButton } from "./connect-button";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const { business } = await requireOwner();

  // Sync the live "cleared to charge" status from Stripe.
  let chargesEnabled = business.stripeChargesEnabled;
  let detailsSubmitted = false;
  if (STRIPE_ENABLED && business.stripeAccountId) {
    try {
      const acct = await stripe.accounts.retrieve(business.stripeAccountId);
      chargesEnabled = Boolean(acct.charges_enabled);
      detailsSubmitted = Boolean(acct.details_submitted);
      if (chargesEnabled !== business.stripeChargesEnabled) {
        await db.business.update({
          where: { id: business.id },
          data: { stripeChargesEnabled: chargesEnabled },
        });
      }
    } catch {
      /* leave stored status */
    }
  }

  const settings = await db.businessSettings.findUnique({ where: { businessId: business.id } });
  const feePct = (settings?.platformFeeBps ?? 0) / 100;
  const started = Boolean(business.stripeAccountId);

  const cardStyle = {
    borderColor: "var(--line)",
    background: "var(--surface)",
    boxShadow: "0 1px 2px rgba(31,30,26,.03)",
  } as const;

  return (
    <Page>
      <Head
        kicker="Payments"
        title="Payouts"
        sub="Connect your bank so customer payments land in your account — not ours."
      />

      {chargesEnabled ? (
        <div className="rounded-xl border p-6" style={cardStyle}>
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="grid place-items-center w-9 h-9 rounded-lg"
              style={{ background: "color-mix(in srgb, var(--pine) 12%, transparent)" }}
            >
              <Check size={18} style={{ color: "var(--pine)" }} />
            </div>
            <div className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
              You&apos;re connected
            </div>
          </div>
          <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            Customer payments go straight to your Stripe account and out to your bank on Stripe&apos;s
            payout schedule. PrepFlow automatically takes a{" "}
            <span className="font-medium" style={{ color: "var(--pine)" }}>{feePct}% platform fee</span> on each charge.
          </p>
          <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
            Manage payouts, view balances, and update bank details anytime from your Stripe Express dashboard.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border p-6" style={cardStyle}>
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="grid place-items-center w-9 h-9 rounded-lg"
              style={{ background: started ? "var(--sand)" : "color-mix(in srgb, var(--clay) 12%, transparent)" }}
            >
              {started ? (
                <AlertTriangle size={18} style={{ color: "var(--clay)" }} />
              ) : (
                <Landmark size={18} style={{ color: "var(--pine)" }} />
              )}
            </div>
            <div className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
              {started ? "Finish connecting your bank" : "Connect your bank to get paid"}
            </div>
          </div>
          <p className="text-[13.5px] mb-4" style={{ color: "var(--ink-soft)" }}>
            {started && detailsSubmitted
              ? "Stripe is reviewing your details. Once approved you can start taking payments."
              : "Set up payouts with Stripe so customer payments land in your bank. Your charges go directly to you; PrepFlow takes a "}
            {!(started && detailsSubmitted) && (
              <span className="font-medium" style={{ color: "var(--pine)" }}>{feePct}% platform fee</span>
            )}
            {!(started && detailsSubmitted) && " per charge. It takes a few minutes — Stripe handles all your banking info securely."}
          </p>
          <ConnectButton label={started ? "Continue setup" : "Connect your bank"} />
          <p className="text-[12px] mt-4" style={{ color: "var(--muted)" }}>
            Until this is complete, your storefront can&apos;t take real payments.
          </p>
        </div>
      )}
    </Page>
  );
}

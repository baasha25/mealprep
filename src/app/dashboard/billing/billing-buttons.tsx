"use client";

import { useState, useTransition } from "react";
import { CreditCard, Check } from "lucide-react";
import { TIERS, TIER_KEYS, feePctLabel, type TierKey } from "@/lib/tiers";
import { startKitchenSubscription, openBillingPortal } from "./actions";

function Msg({ m }: { m: string | null }) {
  if (!m) return null;
  return <p className="text-[12.5px] mt-2" style={{ color: "var(--clay)" }}>{m}</p>;
}

/** Plan cards with Subscribe buttons. When already subscribed, the current plan
 *  is marked and switching is handled through the billing portal. */
export function PlanCards({ currentTier, subscribed }: { currentTier: TierKey; subscribed: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busyTier, setBusyTier] = useState<TierKey | null>(null);

  function subscribe(tier: TierKey) {
    setMsg(null);
    setBusyTier(tier);
    start(async () => {
      const res = await startKitchenSubscription(tier);
      if (res.ok) window.location.href = res.url;
      else { setMsg(res.message); setBusyTier(null); }
    });
  }

  return (
    <div className="grid sm:grid-cols-3 gap-3.5">
      {TIER_KEYS.map((k) => {
        const t = TIERS[k];
        const isCurrent = subscribed && k === currentTier;
        return (
          <div
            key={k}
            className="rounded-xl border p-4 flex flex-col"
            style={{ borderColor: isCurrent ? "var(--pine)" : "var(--line)", background: "var(--surface)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{t.name}</span>
              {isCurrent && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>Current</span>
              )}
            </div>
            <div className="mt-1 mb-2">
              <span className="disp text-[24px] font-medium" style={{ color: "var(--ink)" }}>${Math.round(t.priceCents / 100)}</span>
              <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>/mo</span>
            </div>
            <ul className="space-y-1 mb-3 text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
              <li className="flex items-center gap-1.5"><Check size={12} style={{ color: "var(--pine)" }} /> {t.orderLimit ? `${t.orderLimit} orders/mo` : "Unlimited orders"}</li>
              <li className="flex items-center gap-1.5"><Check size={12} style={{ color: "var(--pine)" }} /> {feePctLabel(k)} platform fee</li>
              <li className="flex items-center gap-1.5"><Check size={12} style={{ color: "var(--pine)" }} /> {t.blurb}</li>
            </ul>
            {isCurrent ? (
              <span className="mt-auto text-center text-[12.5px] py-2" style={{ color: "var(--muted)" }}>Your plan</span>
            ) : (
              <button
                type="button"
                onClick={() => subscribe(k)}
                disabled={pending}
                className="mt-auto rounded-lg py-2 text-[13px] font-medium disabled:opacity-60"
                style={{ background: "var(--pine)", color: "#f4f2ec" }}
              >
                {pending && busyTier === k ? "Starting…" : subscribed ? `Switch to ${t.name}` : `Choose ${t.name}`}
              </button>
            )}
          </div>
        );
      })}
      <div className="sm:col-span-3"><Msg m={msg} /></div>
    </div>
  );
}

/** Opens Stripe's hosted portal (card, invoices, switch/cancel plan). */
export function ManageBillingButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => start(async () => {
          const res = await openBillingPortal();
          if (res.ok) window.location.href = res.url;
          else setMsg(res.message);
        })}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium border disabled:opacity-60"
        style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--paper)" }}
      >
        <CreditCard size={15} /> {pending ? "Opening…" : "Manage billing"}
      </button>
      <Msg m={msg} />
    </div>
  );
}

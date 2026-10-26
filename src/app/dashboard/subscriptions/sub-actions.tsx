"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { formatCents } from "@/lib/money";
import { loadSubscriptionBilling, cancelSubscriptionByOwner, refundLastPaymentByOwner, type SubBilling } from "./actions";

/** Per-subscriber owner controls: cancel the plan, refund the last payment. */
export function SubActions({ subscriptionId, customerName, status }: { subscriptionId: string; customerName: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [billing, setBilling] = useState<SubBilling | null>(null);
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const canceled = status === "canceled";

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !billing) start(async () => setBilling(await loadSubscriptionBilling(subscriptionId)));
  };
  const refundable = billing?.lastPayment && billing.lastPayment.refundedCents < billing.lastPayment.amountCents ? billing.lastPayment.amountCents - billing.lastPayment.refundedCents : 0;

  return (
    <div className="relative inline-block text-left">
      <button type="button" onClick={toggle} aria-label={`Actions for ${customerName}`} className="p-1.5 rounded-md border" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border p-3 text-left shadow-lg" style={{ borderColor: "var(--line)", background: "var(--surface)" }} onMouseLeave={() => setOpen(false)}>
          <div className="text-[12px] mb-2" style={{ color: "var(--muted)" }}>
            {pending && !billing ? (
              <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Checking Stripe…</span>
            ) : billing?.lastPayment ? (
              <>Last payment {formatCents(billing.lastPayment.amountCents)} on {billing.lastPayment.date}{billing.lastPayment.refundedCents > 0 ? ` · ${formatCents(billing.lastPayment.refundedCents)} refunded` : ""}</>
            ) : billing && !billing.stripe ? (
              "No card payments on this plan."
            ) : billing ? (
              "No payment found yet."
            ) : null}
          </div>
          {note && (
            <p className="text-[12px] mb-2 px-2.5 py-1.5 rounded-md" style={{ background: note.ok ? "color-mix(in srgb, var(--pine) 9%, transparent)" : "color-mix(in srgb, var(--clay) 10%, transparent)", color: note.ok ? "var(--pine)" : "var(--clay)" }}>
              {note.message}
            </p>
          )}
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={pending || refundable <= 0}
              onClick={() => {
                if (!confirm(`Refund ${formatCents(refundable)} to ${customerName}? The transfer to your account is reversed and PrepFlow's fee is returned.`)) return;
                start(async () => { const r = await refundLastPaymentByOwner(subscriptionId); setNote(r); if (r.ok) setBilling(await loadSubscriptionBilling(subscriptionId)); });
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[12.5px] font-medium border disabled:opacity-40"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <RotateCcw size={13} /> Refund last payment{refundable > 0 ? ` (${formatCents(refundable)})` : ""}
            </button>
            <button
              type="button"
              disabled={pending || canceled}
              onClick={() => {
                if (!confirm(`Cancel ${customerName}'s plan now? No further charges; deliveries not yet out are cancelled too.`)) return;
                start(async () => setNote(await cancelSubscriptionByOwner(subscriptionId)));
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[12.5px] font-medium disabled:opacity-40"
              style={{ color: "var(--clay)", border: "1px solid color-mix(in srgb, var(--clay) 35%, transparent)" }}
            >
              <XCircle size={13} /> {canceled ? "Already cancelled" : "Cancel subscription"}
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>Plan payments run through PrepFlow&rsquo;s Stripe and are passed to your account, so this is where you refund or cancel them &mdash; not in your Stripe dashboard.</p>
        </div>
      )}
    </div>
  );
}

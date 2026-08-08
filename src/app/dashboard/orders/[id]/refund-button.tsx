"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { refundOrder } from "../actions";

/** Refund an order — Stripe refund if it was paid online, else marks it refunded.
 *  Two-step confirm because refunds can't be undone. */
export function RefundButton({ orderId, amountLabel }: { orderId: string; amountLabel: string }) {
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (msg?.ok) {
    return <span className="text-[12.5px] font-medium" style={{ color: "var(--clay)" }}>{msg.text}</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--line)", color: "var(--clay)", background: "var(--paper)" }}
        >
          <RotateCcw size={14} /> Refund order
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-[12.5px]" style={{ color: "var(--ink)" }}>Refund {amountLabel}?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await refundOrder(orderId);
                setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Refunded." : "Failed.") });
                if (!res.ok) setConfirming(false);
              })
            }
            className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg disabled:opacity-60"
            style={{ background: "var(--clay)", color: "#f4f2ec" }}
          >
            {pending ? "Refunding…" : "Yes, refund"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-[12.5px]" style={{ color: "var(--muted)" }}>Cancel</button>
        </div>
      )}
      {msg && !msg.ok && <p className="text-[12px]" style={{ color: "var(--clay)" }}>{msg.text}</p>}
    </div>
  );
}

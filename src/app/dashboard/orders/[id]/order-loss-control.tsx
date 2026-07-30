"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logOrderLoss } from "../actions";

type LineItem = { mealId: string; name: string; qty: number };

const ORDER_REASONS: { value: "dropped_in_transit" | "order_error" | "remake"; label: string }[] = [
  { value: "dropped_in_transit", label: "Dropped in transit" },
  { value: "order_error", label: "Order error" },
  { value: "remake", label: "Remake (cooked twice)" },
];

const INPUT = "w-full rounded-lg border px-3 py-2 text-[13px] outline-none";
const INPUT_STYLE = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

/**
 * Report a food loss for this order — a dropped/erroneous/remade meal. Books the
 * plate cost against the P&L without altering what the customer was charged.
 */
export function OrderLossControl({ orderId, items }: { orderId: string; items: LineItem[] }) {
  const [open, setOpen] = useState(false);
  const [mealId, setMealId] = useState(items[0]?.mealId ?? "");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<(typeof ORDER_REASONS)[number]["value"]>("dropped_in_transit");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (items.length === 0) return null;

  function submit() {
    setMsg(null);
    const q = Number(qty);
    if (!mealId) return setMsg({ ok: false, text: "Pick a meal." });
    if (!q || q <= 0) return setMsg({ ok: false, text: "Enter how many." });
    start(async () => {
      const res = await logOrderLoss({ orderId, mealId, qty: q, reason, note });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Logged." : "Something went wrong.") });
      if (res.ok) {
        setNote("");
        setQty("1");
      }
    });
  }

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-[12.5px] font-medium px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)", background: "var(--paper)" }}
        >
          <AlertTriangle size={14} style={{ color: "var(--clay)" }} /> Report a remake or loss
        </button>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
            <RefreshCw size={14} style={{ color: "var(--clay)" }} /> Report a remake or loss
          </div>
          <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
            A meal made again or written off costs food twice but is only billed once. Logging it keeps your margins honest — the customer&apos;s charge doesn&apos;t change.
          </p>
          <select className={INPUT} style={INPUT_STYLE} value={mealId} onChange={(e) => setMealId(e.target.value)}>
            {items.map((it) => (
              <option key={it.mealId} value={it.mealId}>
                {it.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              className={INPUT}
              style={INPUT_STYLE}
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="How many"
            />
            <select className={INPUT} style={INPUT_STYLE} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {ORDER_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <input
            className={INPUT}
            style={INPUT_STYLE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={300}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-medium disabled:opacity-60"
              style={{ background: "var(--clay)", color: "#f4f2ec" }}
            >
              {pending ? "Logging…" : "Log loss"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setMsg(null); }}
              className="text-[12.5px]"
              style={{ color: "var(--muted)" }}
            >
              Cancel
            </button>
          </div>
          {msg && (
            <p className="text-[12px]" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

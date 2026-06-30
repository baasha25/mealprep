"use client";

import { useState, useTransition } from "react";
import { Plus, Minus, Trash2, Wallet, Check } from "lucide-react";
import { formatCents } from "@/lib/money";
import { computeOrder } from "@/lib/pricing";
import { placePosOrder } from "./actions";

export type PosMeal = { id: string; name: string; priceCents: number; diet: string | null; swatch: string };

export function Pos({ meals, taxRateBps }: { meals: PosMeal[]; taxRateBps: number }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ code: string; total: number } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const byId = new Map(meals.map((m) => [m.id, m]));
  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const sub = (id: string) =>
    setCart((c) => {
      const n = (c[id] || 0) - 1;
      const x = { ...c };
      if (n <= 0) delete x[id];
      else x[id] = n;
      return x;
    });
  const clear = () => {
    setCart({});
    setName("");
  };

  const lines = Object.entries(cart).map(([id, qty]) => ({ priceCents: byId.get(id)?.priceCents ?? 0, qty }));
  const totals = computeOrder({
    lines,
    settings: { subDiscountBps: 0, taxRateBps, deliveryFeeCents: 0, processingFeeCents: 0, minOrderCents: 0 },
    subscribe: false,
  });

  const charge = () => {
    setError("");
    start(async () => {
      const r = await placePosOrder({
        items: Object.entries(cart).map(([mealId, qty]) => ({ mealId, qty })),
        customerName: name,
      });
      if (r.ok) {
        setDone({ code: r.orderId.slice(-6), total: r.totalCents });
        clear();
        setTimeout(() => setDone(null), 3500);
      } else setError(r.message);
    });
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      {/* Menu grid */}
      <div className="grid sm:grid-cols-3 gap-3">
        {meals.map((m) => {
          const qty = cart[m.id] || 0;
          return (
            <button
              key={m.id}
              onClick={() => add(m.id)}
              className="relative text-left rounded-xl border p-3.5 transition-transform active:scale-[0.98]"
              style={{ borderColor: qty ? "var(--pine)" : "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}
            >
              <div className="h-1.5 w-8 rounded-full mb-2.5" style={{ background: m.swatch }} />
              <div className="text-[13.5px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{m.name}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="disp text-[16px] font-medium" style={{ color: "var(--ink)" }}>{formatCents(m.priceCents)}</span>
                {qty > 0 && (
                  <span className="grid place-items-center min-w-6 h-6 px-1.5 rounded-md text-[12.5px] font-semibold" style={{ background: "var(--pine)", color: "#f4f2ec" }}>{qty}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Ticket */}
      <aside className="lg:sticky lg:top-6 h-fit rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} style={{ color: "var(--pine)" }} />
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Current sale</h2>
          {totals.itemCount > 0 && (
            <button onClick={clear} className="ml-auto grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--paper)" }} aria-label="Clear">
              <Trash2 size={13} style={{ color: "var(--clay)" }} />
            </button>
          )}
        </div>

        {done ? (
          <div className="text-center py-8 fade">
            <div className="grid place-items-center w-12 h-12 rounded-full mx-auto mb-3" style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}>
              <Check size={24} style={{ color: "var(--pine)" }} />
            </div>
            <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Charged {formatCents(done.total)}</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>Sale #{done.code} recorded</div>
          </div>
        ) : totals.itemCount === 0 ? (
          <p className="text-[13px] py-9 text-center" style={{ color: "var(--muted)" }}>Tap meals to start a sale.</p>
        ) : (
          <>
            <div className="space-y-2 mb-4 max-h-56 overflow-auto">
              {Object.entries(cart).map(([id, q]) => {
                const m = byId.get(id);
                return m ? (
                  <div key={id} className="flex items-center gap-2 text-[13px]">
                    <span className="flex-1 truncate" style={{ color: "var(--ink)" }}>{m.name}</span>
                    <div className="flex items-center gap-2 px-1.5 py-0.5 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                      <button onClick={() => sub(id)} aria-label="Remove one"><Minus size={13} style={{ color: "var(--ink)" }} /></button>
                      <span className="text-[12.5px] font-semibold w-3 text-center" style={{ color: "var(--ink)" }}>{q}</span>
                      <button onClick={() => add(id)} aria-label="Add one"><Plus size={13} style={{ color: "var(--ink)" }} /></button>
                    </div>
                    <span className="w-14 text-right" style={{ color: "var(--muted)" }}>{formatCents(m.priceCents * q)}</span>
                  </div>
                ) : null;
              })}
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name (optional)"
              className="w-full px-3 py-2 rounded-md border text-[13px] outline-none mb-3"
              style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />

            <div className="space-y-1.5 text-[13px] py-3 border-t border-b mb-3" style={{ borderColor: "var(--line)" }}>
              <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Subtotal</span><span style={{ color: "var(--ink)" }}>{formatCents(totals.subtotalCents)}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Tax</span><span style={{ color: "var(--ink)" }}>{formatCents(totals.taxCents)}</span></div>
            </div>
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Total</span>
              <span className="disp text-[22px] font-medium" style={{ color: "var(--pine)" }}>{formatCents(totals.totalCents)}</span>
            </div>
            {error && <p className="text-[12px] mb-2" style={{ color: "var(--clay)" }}>{error}</p>}
            <button
              onClick={charge}
              disabled={pending}
              className="w-full py-2.5 rounded-lg font-medium text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              <Wallet size={16} /> {pending ? "Charging…" : `Charge ${formatCents(totals.totalCents)}`}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

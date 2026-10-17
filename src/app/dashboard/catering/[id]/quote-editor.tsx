"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2, Send, Save, Loader2 } from "lucide-react";
import { formatCents, centsToDollars, dollarsToCents } from "@/lib/money";
import { quoteTotals, type CateringLineT, type CateringStatus } from "@/lib/catering";
import { saveQuote, type QuoteActionState } from "../actions";

type MenuItem = { id: string; name: string; priceCents: number };
const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;
const INP = "px-2.5 py-1.5 rounded-md border text-[13px] outline-none";

/**
 * The owner's quote: lines from the menu (or custom), delivery fee, discount,
 * and a note. Totals update live; "Send" emails the customer a link to approve.
 */
export function QuoteEditor({
  requestId,
  status,
  initialLines,
  deliveryFeeCents,
  discountCents,
  ownerNote,
  taxRateBps,
  menu,
}: {
  requestId: string;
  status: CateringStatus;
  initialLines: CateringLineT[];
  deliveryFeeCents: number;
  discountCents: number;
  ownerNote: string;
  taxRateBps: number;
  menu: MenuItem[];
}) {
  const [lines, setLines] = useState<CateringLineT[]>(initialLines);
  const [fee, setFee] = useState(String(centsToDollars(deliveryFeeCents)));
  const [disc, setDisc] = useState(String(centsToDollars(discountCents)));
  const [note, setNote] = useState(ownerNote);
  const [pick, setPick] = useState("");
  const [state, action, pending] = useActionState<QuoteActionState, FormData>(saveQuote, null);

  const totals = useMemo(
    () => quoteTotals(lines, { deliveryFeeCents: dollarsToCents(fee || 0), discountCents: dollarsToCents(disc || 0), taxRateBps }),
    [lines, fee, disc, taxRateBps],
  );

  const update = (i: number, patch: Partial<CateringLineT>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));
  const addFromMenu = (id: string) => {
    const m = menu.find((x) => x.id === id);
    if (!m) return;
    setLines((ls) => {
      const at = ls.findIndex((l) => l.mealId === m.id);
      if (at >= 0) return ls.map((l, j) => (j === at ? { ...l, qty: l.qty + 10 } : l));
      return [...ls, { mealId: m.id, name: m.name, qty: 10, unitPriceCents: m.priceCents }];
    });
    setPick("");
  };
  const addCustom = () => setLines((ls) => [...ls, { mealId: null, name: "", qty: 1, unitPriceCents: 0 }]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={requestId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <div className="flex flex-wrap gap-2">
        <select value={pick} onChange={(e) => addFromMenu(e.target.value)} className={`${INP} flex-1 min-w-[220px]`} style={inputStyle}>
          <option value="">+ Add from your menu…</option>
          {menu.map((m) => (
            <option key={m.id} value={m.id}>{m.name} · {formatCents(m.priceCents)}</option>
          ))}
        </select>
        <button type="button" onClick={addCustom} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
          <Plus size={14} /> Custom line
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="text-[13px] rounded-lg px-3.5 py-3" style={{ background: "var(--paper)", border: "1px dashed var(--line)", color: "var(--muted)" }}>
          No lines yet. Add meals from the menu (price fills in from your menu) or a custom line such as “Dessert platter”.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_72px_96px_96px_28px] gap-2 text-[11px] font-semibold uppercase tracking-wide px-1" style={{ color: "var(--muted)" }}>
            <div>Item</div><div>Qty</div><div>Unit $</div><div className="text-right">Line</div><div />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_72px_96px_96px_28px] grid-cols-2 gap-2 items-center">
              <input value={l.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Item name" className={`${INP} w-full col-span-2 sm:col-span-1`} style={inputStyle} readOnly={!!l.mealId} title={l.mealId ? "From your menu" : "Custom line"} />
              <input type="number" min={1} value={l.qty} onChange={(e) => update(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className={`${INP} w-full`} style={inputStyle} />
              <input type="number" min={0} step="0.01" value={centsToDollars(l.unitPriceCents)} onChange={(e) => update(i, { unitPriceCents: dollarsToCents(e.target.value || 0) })} className={`${INP} w-full`} style={inputStyle} />
              <div className="text-[13.5px] text-right font-medium" style={{ color: "var(--ink)" }}>{formatCents(l.qty * l.unitPriceCents)}</div>
              <button type="button" onClick={() => remove(i)} aria-label="Remove line" className="justify-self-end"><Trash2 size={15} style={{ color: "var(--muted)" }} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Delivery / set-up fee ($)</span>
          <input name="deliveryFee" type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className={`${INP} w-full`} style={inputStyle} />
        </label>
        <label className="block">
          <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Discount ($)</span>
          <input name="discount" type="number" min={0} step="0.01" value={disc} onChange={(e) => setDisc(e.target.value)} className={`${INP} w-full`} style={inputStyle} />
        </label>
      </div>
      <label className="block">
        <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Note to the customer (optional)</span>
        <textarea name="ownerNote" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${INP} w-full`} style={inputStyle} placeholder="e.g. Boxed individually with labels. We'll arrive 30 minutes before your start time. Vegetarian and gluten-free boxes marked." />
      </label>

      <div className="rounded-lg px-4 py-3 space-y-1 text-[13px]" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
        <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>{totals.mealCount} meals · subtotal</span><span>{formatCents(totals.subtotalCents)}</span></div>
        {totals.discountCents > 0 && <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>Discount</span><span>− {formatCents(totals.discountCents)}</span></div>}
        {totals.deliveryFeeCents > 0 && <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>Delivery / set-up</span><span>{formatCents(totals.deliveryFeeCents)}</span></div>}
        <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>Tax ({(taxRateBps / 100).toFixed(2)}%)</span><span>{formatCents(totals.taxCents)}</span></div>
        <div className="flex justify-between text-[16px] font-semibold pt-1" style={{ color: "var(--ink)" }}><span>Customer pays</span><span>{formatCents(totals.totalCents)}</span></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="intent" value="send" disabled={pending || totals.mealCount === 0} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {status === "quoted" ? "Send updated quote" : "Send quote"}
        </button>
        <button type="submit" name="intent" value="save" disabled={pending} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border disabled:opacity-60" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
          <Save size={14} /> Save draft
        </button>
        {state && <span className="text-[12.5px]" style={{ color: state.ok ? "var(--pine)" : "var(--clay)" }}>{state.message}</span>}
      </div>
      <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>The customer gets an email with this quote and an “Approve &amp; pay” button. Nothing is charged until they approve. Once approved, the quote locks.</p>
    </form>
  );
}

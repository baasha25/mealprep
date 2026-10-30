"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2, Send, Save, Loader2, Layers } from "lucide-react";
import { formatCents, centsToDollars, dollarsToCents } from "@/lib/money";
import { quoteTotals, type CateringLineT, type CateringStatus } from "@/lib/catering";
import { paymentPlan, depositFor, TERMS_LABEL, MAX_OPTIONS, type CateringTerms, type CateringOptionT } from "@/lib/catering-terms";
import { saveQuote, type QuoteActionState } from "../actions";

type MenuItem = { id: string; name: string; priceCents: number; perGuest: boolean };
const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;
const INP = "px-2.5 py-1.5 rounded-md border text-[13px] outline-none";

type Draft = { label: string; lines: CateringLineT[]; fee: string; disc: string; note: string };

/**
 * The owner's quote: lines from the menu (or custom), delivery fee, discount,
 * and a note. Totals update live; "Send" emails the customer a link to approve.
 * "Add an option" turns it into a proposal with up to three alternatives the
 * client chooses between; option 1 is always this main quote.
 */
export function QuoteEditor({
  requestId,
  status,
  initialLines,
  initialOptions,
  deliveryFeeCents,
  discountCents,
  ownerNote,
  taxRateBps,
  menu,
  headcount,
  terms,
  depositBps,
}: {
  requestId: string;
  status: CateringStatus;
  initialLines: CateringLineT[];
  initialOptions: CateringOptionT[];
  deliveryFeeCents: number;
  discountCents: number;
  ownerNote: string;
  taxRateBps: number;
  menu: MenuItem[];
  headcount: number | null;
  terms: CateringTerms;
  depositBps: number;
}) {
  const [lines, setLines] = useState<CateringLineT[]>(initialLines);
  const [fee, setFee] = useState(String(centsToDollars(deliveryFeeCents)));
  const [disc, setDisc] = useState(String(centsToDollars(discountCents)));
  const [note, setNote] = useState(ownerNote);
  const [pick, setPick] = useState("");
  // Extra options beyond the main quote (option 1 is the form above).
  const [extras, setExtras] = useState<Draft[]>(
    initialOptions.slice(1).map((o) => ({ label: o.label, lines: o.items, fee: String(centsToDollars(o.deliveryFeeCents)), disc: String(centsToDollars(o.discountCents)), note: o.ownerNote ?? "" })),
  );
  const [state, action, pending] = useActionState<QuoteActionState, FormData>(saveQuote, null);

  const totals = useMemo(
    () => quoteTotals(lines, { deliveryFeeCents: dollarsToCents(fee || 0), discountCents: dollarsToCents(disc || 0), taxRateBps }),
    [lines, fee, disc, taxRateBps],
  );
  const plan = paymentPlan(totals.totalCents, depositBps, terms);

  const addFromMenu = (id: string, setter: (fn: (ls: CateringLineT[]) => CateringLineT[]) => void) => {
    const m = menu.find((x) => x.id === id);
    if (!m) return;
    setter((ls) => {
      const at = ls.findIndex((l) => l.mealId === m.id);
      const startQty = m.perGuest && headcount ? headcount : 10;
      if (at >= 0) return ls.map((l, j) => (j === at ? { ...l, qty: l.qty + (m.perGuest ? 0 : 10) } : l));
      return [...ls, { mealId: m.id, name: m.perGuest ? `${m.name} (per guest)` : m.name, qty: startQty, unitPriceCents: m.priceCents }];
    });
    setPick("");
  };
  const addCustom = (setter: (fn: (ls: CateringLineT[]) => CateringLineT[]) => void) => setter((ls) => [...ls, { mealId: null, name: "", qty: 1, unitPriceCents: 0 }]);

  const optionsJson = JSON.stringify(
    extras.map((o) => ({ label: o.label || "Option", items: o.lines, deliveryFeeCents: dollarsToCents(o.fee || 0), discountCents: dollarsToCents(o.disc || 0), ownerNote: o.note || null })),
  );

  const renderLines = (ls: CateringLineT[], setter: (fn: (ls: CateringLineT[]) => CateringLineT[]) => void) => (
    <>
      <div className="flex flex-wrap gap-2">
        <select value={pick} onChange={(e) => addFromMenu(e.target.value, setter)} className={`${INP} flex-1 min-w-[220px]`} style={inputStyle}>
          <option value="">+ Add from your menu…</option>
          {menu.map((m) => (
            <option key={m.id} value={m.id}>{m.name} · {formatCents(m.priceCents)}{m.perGuest ? " a head" : ""}</option>
          ))}
        </select>
        <button type="button" onClick={() => addCustom(setter)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
          <Plus size={14} /> Custom line
        </button>
      </div>
      {ls.length === 0 ? (
        <p className="text-[13px] rounded-lg px-3.5 py-3 mt-2" style={{ background: "var(--paper)", border: "1px dashed var(--line)", color: "var(--muted)" }}>
          No lines yet. Add meals from the menu (price fills in from your menu) or a custom line such as “Dessert platter” or “Set-up and service”.
        </p>
      ) : (
        <div className="space-y-2 mt-2">
          <div className="hidden sm:grid grid-cols-[1fr_72px_96px_96px_28px] gap-2 text-[11px] font-semibold uppercase tracking-wide px-1" style={{ color: "var(--muted)" }}>
            <div>Item</div><div>Qty</div><div>Unit $</div><div className="text-right">Line</div><div />
          </div>
          {ls.map((l, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_72px_96px_96px_28px] grid-cols-2 gap-2 items-center">
              <input value={l.name} onChange={(e) => setter((cur) => cur.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Item name" className={`${INP} w-full col-span-2 sm:col-span-1`} style={inputStyle} readOnly={!!l.mealId} title={l.mealId ? "From your menu" : "Custom line"} />
              <input type="number" min={1} value={l.qty} onChange={(e) => setter((cur) => cur.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} className={`${INP} w-full`} style={inputStyle} />
              <input type="number" min={0} step="0.01" value={centsToDollars(l.unitPriceCents)} onChange={(e) => setter((cur) => cur.map((x, j) => (j === i ? { ...x, unitPriceCents: dollarsToCents(e.target.value || 0) } : x)))} className={`${INP} w-full`} style={inputStyle} />
              <div className="text-[13.5px] text-right font-medium" style={{ color: "var(--ink)" }}>{formatCents(l.qty * l.unitPriceCents)}</div>
              <button type="button" onClick={() => setter((cur) => cur.filter((_, j) => j !== i))} aria-label="Remove line" className="justify-self-end"><Trash2 size={15} style={{ color: "var(--muted)" }} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={requestId} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="options" value={optionsJson} />

      {extras.length > 0 && <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Option 1 (main quote)</div>}
      {renderLines(lines, (fn) => setLines(fn))}

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

      {/* Alternatives */}
      {extras.map((o, oi) => (
        <div key={oi} className="rounded-lg border p-3.5 space-y-3" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            <Layers size={14} style={{ color: "var(--muted)" }} />
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Option {oi + 2}</span>
            <input value={o.label} onChange={(e) => setExtras((xs) => xs.map((x, j) => (j === oi ? { ...x, label: e.target.value } : x)))} placeholder="e.g. Platters instead of boxes" className={`${INP} flex-1`} style={inputStyle} />
            <button type="button" onClick={() => setExtras((xs) => xs.filter((_, j) => j !== oi))} className="text-[12px]" style={{ color: "var(--clay)" }}>Remove</button>
          </div>
          {renderLines(o.lines, (fn) => setExtras((xs) => xs.map((x, j) => (j === oi ? { ...x, lines: fn(x.lines) } : x))))}
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block"><span className="text-[12px] block mb-1" style={{ color: "var(--muted)" }}>Fee ($)</span><input type="number" min={0} step="0.01" value={o.fee} onChange={(e) => setExtras((xs) => xs.map((x, j) => (j === oi ? { ...x, fee: e.target.value } : x)))} className={`${INP} w-full`} style={inputStyle} /></label>
            <label className="block"><span className="text-[12px] block mb-1" style={{ color: "var(--muted)" }}>Discount ($)</span><input type="number" min={0} step="0.01" value={o.disc} onChange={(e) => setExtras((xs) => xs.map((x, j) => (j === oi ? { ...x, disc: e.target.value } : x)))} className={`${INP} w-full`} style={inputStyle} /></label>
            <div className="text-[13px] self-end pb-1.5 text-right font-medium" style={{ color: "var(--ink)" }}>
              Total {formatCents(quoteTotals(o.lines, { deliveryFeeCents: dollarsToCents(o.fee || 0), discountCents: dollarsToCents(o.disc || 0), taxRateBps }).totalCents)}
            </div>
          </div>
        </div>
      ))}
      {extras.length < MAX_OPTIONS - 1 && (
        <button type="button" onClick={() => setExtras((xs) => [...xs, { label: "", lines: [], fee: fee, disc: "0", note: "" }])} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--pine)" }}>
          <Plus size={14} /> Add an option for the client to choose from
        </button>
      )}

      <div className="rounded-lg px-4 py-3 space-y-1 text-[13px]" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
        <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>{totals.mealCount} meals · subtotal</span><span>{formatCents(totals.subtotalCents)}</span></div>
        {totals.discountCents > 0 && <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>Discount</span><span>− {formatCents(totals.discountCents)}</span></div>}
        {totals.deliveryFeeCents > 0 && <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>Delivery / set-up</span><span>{formatCents(totals.deliveryFeeCents)}</span></div>}
        <div className="flex justify-between" style={{ color: "var(--muted)" }}><span>Tax ({(taxRateBps / 100).toFixed(2)}%)</span><span>{formatCents(totals.taxCents)}</span></div>
        <div className="flex justify-between text-[16px] font-semibold pt-1" style={{ color: "var(--ink)" }}><span>Customer pays</span><span>{formatCents(totals.totalCents)}</span></div>
        <div className="text-[12px] pt-1" style={{ color: "var(--ink-soft)" }}>
          {plan.mode === "invoice"
            ? `On approval: invoice issued, ${TERMS_LABEL[terms]}. No card needed.`
            : plan.mode === "card_deposit"
              ? `On approval: ${formatCents(depositFor(totals.totalCents, depositBps))} deposit by card; balance ${formatCents(plan.laterCents)} before the event.`
              : "On approval: full amount by card."}{" "}
          <span style={{ color: "var(--muted)" }}>Change in Settings → Catering.</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="intent" value="send" disabled={pending || totals.mealCount === 0} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {status === "quoted" ? "Send updated quote" : extras.length ? "Send proposal" : "Send quote"}
        </button>
        <button type="submit" name="intent" value="save" disabled={pending} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border disabled:opacity-60" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
          <Save size={14} /> Save draft
        </button>
        {state && <span className="text-[12.5px]" style={{ color: state.ok ? "var(--pine)" : "var(--clay)" }}>{state.message}</span>}
      </div>
      <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>The customer gets an email with this quote and an “Approve” button. Nothing is charged until they approve. Once approved, the quote locks.</p>
    </form>
  );
}

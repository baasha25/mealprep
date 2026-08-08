"use client";

import { useState, useTransition } from "react";
import { PackagePlus } from "lucide-react";
import { UNITS } from "@/lib/menu-constants";
import { Hint } from "@/components/ui";
import { setOpeningStock } from "./actions";

const INP = "w-full rounded-lg border px-3 py-2 text-[13.5px] outline-none";
const ST = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

/**
 * Enter what you ALREADY have on hand right now (opening / standing inventory).
 * Existing ingredients autocomplete (and prefill their unit); new ones are created.
 */
const CUP_ML = 236.588236;

export function OpeningStockForm({ ingredients }: { ingredients: { name: string; unit: string; densityGPerMl?: number | null }[] }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("lb");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [trim, setTrim] = useState("");
  const [gpc, setGpc] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const metaByName = new Map(ingredients.map((i) => [i.name.toLowerCase(), i]));

  function pickName(v: string) {
    setName(v);
    const m = metaByName.get(v.trim().toLowerCase());
    if (m?.unit && (UNITS as readonly string[]).includes(m.unit)) setUnit(m.unit as (typeof UNITS)[number]);
    if (m) setGpc(m.densityGPerMl ? String(Math.round(m.densityGPerMl * CUP_ML)) : "");
  }

  function submit() {
    setMsg(null);
    if (!name.trim()) return setMsg({ ok: false, text: "Enter an ingredient name." });
    const q = Number(qty);
    if (!(q >= 0) || qty === "") return setMsg({ ok: false, text: "Enter a quantity." });
    start(async () => {
      const res = await setOpeningStock({
        name: name.trim(),
        unit,
        quantity: q,
        cost: Number(cost) || 0,
        trim: Number(trim) || 0,
        gramsPerCup: gpc === "" ? undefined : Number(gpc) || 0,
      });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Something went wrong.") });
      if (res.ok) {
        setName("");
        setQty("");
        setCost("");
        setTrim("");
        setGpc("");
      }
    });
  }

  return (
    <div>
      <div className="grid sm:grid-cols-[1.4fr_80px_90px_100px_80px_auto] gap-2.5 items-end">
        <div>
          <label className="text-[11px] block mb-1" style={{ color: "var(--muted)" }}>Ingredient</label>
          <input className={INP} style={ST} list="pf-opening-ings" value={name} onChange={(e) => pickName(e.target.value)} placeholder="e.g. Chicken breast" autoComplete="off" />
          <datalist id="pf-opening-ings">
            {ingredients.map((i) => <option key={i.name} value={i.name} />)}
          </datalist>
        </div>
        <div>
          <label className="text-[11px] mb-1 flex items-center gap-1" style={{ color: "var(--muted)" }}>Unit <Hint text="The unit you buy/stock this ingredient in. Recipes can use any compatible unit (e.g. buy in lb, use in oz) — it converts automatically." /></label>
          <select className={INP} style={ST} value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] block mb-1" style={{ color: "var(--muted)" }}>On hand</label>
          <input className={INP} style={ST} type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-[11px] mb-1 flex items-center gap-1" style={{ color: "var(--muted)" }}>Cost / unit ($) <Hint text="What you pay per unit (e.g. $3.20 per lb). This is what your plate cost, margins, and P&L are calculated from." /></label>
          <input className={INP} style={ST} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="text-[11px] mb-1 flex items-center gap-1" style={{ color: "var(--muted)" }}>Trim % <Hint text="Share of this ingredient lost to prep — peels, stalks, fat, ends. Drives the 'over-bought' figure: you buy more than a recipe nets to cover the waste." /></label>
          <input className={INP} style={ST} type="number" min="0" max="100" step="0.1" value={trim} onChange={(e) => setTrim(e.target.value)} placeholder="0" />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium disabled:opacity-60"
          style={{ background: "var(--pine)", color: "#f4f2ec" }}
        >
          <PackagePlus size={15} /> {pending ? "Saving…" : "Set stock"}
        </button>
      </div>

      {/* Optional pack density — only needed to use a volume unit for a weight-priced
          ingredient (or vice-versa). One cup of quinoa vs. oil weigh differently. */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <label className="text-[11.5px] flex items-center gap-1" style={{ color: "var(--muted)" }}>
          Pack density
          <Hint text="Optional. Only needed if you buy this by weight but measure it by volume in recipes (or vice-versa). Enter how much one cup weighs in grams — e.g. quinoa ≈ 180 g/cup, oil ≈ 218 g/cup." />
        </label>
        <input
          className="w-20 rounded-lg border px-2.5 py-1.5 text-[13px] outline-none"
          style={ST}
          type="number"
          min="0"
          step="1"
          value={gpc}
          onChange={(e) => setGpc(e.target.value)}
          placeholder="—"
        />
        <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>grams / cup</span>
      </div>

      {msg && (
        <p className="text-[12.5px] mt-2" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>{msg.text}</p>
      )}
    </div>
  );
}

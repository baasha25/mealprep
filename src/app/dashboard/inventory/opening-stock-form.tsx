"use client";

import { useState, useTransition } from "react";
import { PackagePlus, Search, Sparkles, X } from "lucide-react";
import { UNITS } from "@/lib/menu-constants";
import { Hint } from "@/components/ui";
import {
  searchNutritionLibrary,
  perUnitMacros,
  type LibraryIngredient,
} from "@/lib/nutrition-library";
import { setOpeningStock } from "./actions";

const INP = "w-full rounded-lg border px-3 py-2 text-[13.5px] outline-none";
const ST = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

/**
 * Enter what you ALREADY have on hand right now (opening / standing inventory).
 * Existing ingredients autocomplete (and prefill their unit); new ones are created.
 */
const CUP_ML = 236.588236;

export function OpeningStockForm({ ingredients }: { ingredients: { name: string; unit: string; densityGPerMl?: number | null; calPerUnit?: number; proteinPerUnit?: number; carbsPerUnit?: number; fatPerUnit?: number }[] }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("lb");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [trim, setTrim] = useState("");
  const [gpc, setGpc] = useState("");
  const [macros, setMacros] = useState({ cal: "", protein: "", carbs: "", fat: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Shared nutrition library — search & auto-fill common ingredients' macros.
  const [libQuery, setLibQuery] = useState("");
  const [libEntry, setLibEntry] = useState<LibraryIngredient | null>(null);
  const libResults = libQuery.trim() ? searchNutritionLibrary(libQuery, 8) : [];

  const metaByName = new Map(ingredients.map((i) => [i.name.toLowerCase(), i]));

  // Set the four macro fields from a library entry, converted to a given unit.
  function fillMacrosFromLibrary(entry: LibraryIngredient, forUnit: string) {
    const m = perUnitMacros(entry, forUnit);
    if (!m) return; // unit can't convert (e.g. a volume unit with no density)
    setMacros({ cal: String(m.calories), protein: String(m.proteinG), carbs: String(m.carbsG), fat: String(m.fatG) });
  }

  function applyLibrary(entry: LibraryIngredient) {
    const u =
      entry.defaultUnit && (UNITS as readonly string[]).includes(entry.defaultUnit)
        ? (entry.defaultUnit as (typeof UNITS)[number])
        : unit;
    setName(entry.name);
    setUnit(u);
    if (entry.densityGPerMl) setGpc(String(Math.round(entry.densityGPerMl * CUP_ML)));
    fillMacrosFromLibrary(entry, u);
    setLibEntry(entry);
    setLibQuery("");
  }

  // Changing the unit re-derives macros from the library entry (they're per-unit).
  function changeUnit(u: (typeof UNITS)[number]) {
    setUnit(u);
    if (libEntry) fillMacrosFromLibrary(libEntry, u);
  }

  function pickName(v: string) {
    setName(v);
    setLibEntry(null); // typing a name by hand detaches any library selection
    const m = metaByName.get(v.trim().toLowerCase());
    if (m?.unit && (UNITS as readonly string[]).includes(m.unit)) setUnit(m.unit as (typeof UNITS)[number]);
    if (m) setGpc(m.densityGPerMl ? String(Math.round(m.densityGPerMl * CUP_ML)) : "");
    if (m) {
      setMacros({
        cal: m.calPerUnit ? String(m.calPerUnit) : "",
        protein: m.proteinPerUnit ? String(m.proteinPerUnit) : "",
        carbs: m.carbsPerUnit ? String(m.carbsPerUnit) : "",
        fat: m.fatPerUnit ? String(m.fatPerUnit) : "",
      });
    }
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
        calPerUnit: macros.cal === "" ? undefined : Number(macros.cal) || 0,
        proteinPerUnit: macros.protein === "" ? undefined : Number(macros.protein) || 0,
        carbsPerUnit: macros.carbs === "" ? undefined : Number(macros.carbs) || 0,
        fatPerUnit: macros.fat === "" ? undefined : Number(macros.fat) || 0,
      });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Something went wrong.") });
      if (res.ok) {
        setName("");
        setQty("");
        setCost("");
        setTrim("");
        setGpc("");
        setMacros({ cal: "", protein: "", carbs: "", fat: "" });
      }
    });
  }

  return (
    <div>
      {/* Nutrition library — search common ingredients and auto-fill their macros
          (per your chosen unit), so you don't type calories/protein by hand. */}
      <div className="mb-3.5">
        <label className="text-[11.5px] mb-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Sparkles size={13} style={{ color: "var(--pine)" }} />
          Auto-fill from nutrition library
          <Hint text="Search a shared catalog of common ingredients (USDA per-100g values). Picking one fills the unit, pack density, and per-unit calories & macros — converted to your unit. Verify and tweak as needed." />
        </label>
        <div className="relative" style={{ maxWidth: 460 }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            className="w-full rounded-lg border pl-9 pr-8 py-2 text-[13.5px] outline-none"
            style={ST}
            value={libQuery}
            onChange={(e) => setLibQuery(e.target.value)}
            placeholder="Search e.g. chicken breast, olive oil, quinoa…"
            autoComplete="off"
          />
          {libQuery && (
            <button
              type="button"
              onClick={() => setLibQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X size={14} style={{ color: "var(--muted)" }} />
            </button>
          )}
          {libResults.length > 0 && (
            <div
              className="absolute z-20 mt-1 w-full rounded-lg border overflow-hidden shadow-lg"
              style={{ borderColor: "var(--line)", background: "var(--surface)", maxHeight: 260, overflowY: "auto" }}
            >
              {libResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => applyLibrary(r)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[color:var(--paper)]"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <span className="text-[13px]" style={{ color: "var(--ink)" }}>
                    {r.name}
                    <span className="text-[11px] ml-1.5" style={{ color: "var(--muted)" }}>{r.category}</span>
                  </span>
                  <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {r.per100g.cal} cal · {r.per100g.proteinG}g P /100g
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {libEntry && (
          <p className="text-[11.5px] mt-1.5 flex items-center gap-1.5" style={{ color: "var(--pine)" }}>
            <Sparkles size={12} /> Filled from library: <strong>{libEntry.name}</strong> — verify &amp; adjust below.
          </p>
        )}
      </div>

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
          <select className={INP} style={ST} value={unit} onChange={(e) => changeUnit(e.target.value as (typeof UNITS)[number])}>
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

      {/* Optional per-unit macros — sum into a meal's nutrition automatically once
          the ingredient is used in a recipe. Leave blank to skip. */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <label className="text-[11.5px] flex items-center gap-1" style={{ color: "var(--muted)" }}>
          Nutrition / {unit}
          <Hint text={`Optional. Per-${unit} calories and macros. When this ingredient is used in a meal, its recipe can auto-fill the meal's nutrition (Menu → meal → Calc from recipe).`} />
        </label>
        {([
          ["cal", "cal"],
          ["protein", "P g"],
          ["carbs", "C g"],
          ["fat", "F g"],
        ] as const).map(([k, l]) => (
          <div key={k} className="flex items-center gap-1">
            <input
              className="w-16 rounded-lg border px-2.5 py-1.5 text-[13px] outline-none"
              style={ST}
              type="number"
              min="0"
              step="0.1"
              value={macros[k]}
              onChange={(e) => {
                setLibEntry(null); // manual edit wins over the library value
                setMacros((cur) => ({ ...cur, [k]: e.target.value }));
              }}
              placeholder="—"
            />
            <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{l}</span>
          </div>
        ))}
      </div>

      {msg && (
        <p className="text-[12.5px] mt-2" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>{msg.text}</p>
      )}
    </div>
  );
}

"use client";

import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ALLERGENS, UNITS } from "@/lib/menu-constants";
import { INP } from "@/components/ui";

export type OptionIngredientRow = { name: string; qty: string; unit: string; trimPercent: string };
export type OptionRow = {
  id?: string;
  name: string;
  priceDelta: string; // dollars, may be negative ("-1.00")
  isDefault: boolean;
  allergens: string[];
  ingredients: OptionIngredientRow[];
};
export type OptionGroupRow = {
  id?: string;
  name: string;
  minSelect: string;
  maxSelect: string;
  options: OptionRow[];
};

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;
const blankIng = (): OptionIngredientRow => ({ name: "", qty: "", unit: "oz", trimPercent: "" });
const blankOption = (): OptionRow => ({ name: "", priceDelta: "", isDefault: false, allergens: [], ingredients: [] });
const blankGroup = (): OptionGroupRow => ({ name: "", minSelect: "1", maxSelect: "1", options: [blankOption(), blankOption()] });

/**
 * Build-your-own editor. Each option carries its OWN ingredient rows, so a
 * customer's choice flows into plate cost, purchasing, and label macros.
 * Serialized into a hidden JSON field by the parent form.
 */
export function OptionGroupsEditor({ value, onChange }: { value: OptionGroupRow[]; onChange: (v: OptionGroupRow[]) => void }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const upd = (gi: number, patch: Partial<OptionGroupRow>) => onChange(value.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updOpt = (gi: number, oi: number, patch: Partial<OptionRow>) =>
    upd(gi, { options: value[gi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });
  const updIng = (gi: number, oi: number, ii: number, patch: Partial<OptionIngredientRow>) =>
    updOpt(gi, oi, { ingredients: value[gi].options[oi].ingredients.map((r, i) => (i === ii ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
        Let customers build their own: e.g. <em>Base</em> (quinoa | brown rice), <em>Protein</em> (chicken | tofu), <em>Extras</em> (+avocado).
        Give each option its ingredients so plate cost, the shopping list, and labels stay accurate for every combination.
      </p>

      {value.map((g, gi) => {
        const isOpen = open[gi] ?? true;
        return (
          <div key={gi} className="rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [gi]: !isOpen }))} className="grid place-items-center w-6 h-6" style={{ color: "var(--muted)" }} aria-label={isOpen ? "Collapse" : "Expand"}>
                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              <input value={g.name} onChange={(e) => upd(gi, { name: e.target.value })} placeholder="Group name (e.g. Base, Protein, Extras)" className={`${INP} flex-1`} style={inputStyle} />
              <label className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--muted)" }} title="0 = optional group">
                min
                <input type="number" min="0" max="10" value={g.minSelect} onChange={(e) => upd(gi, { minSelect: e.target.value })} className={`${INP} w-14`} style={inputStyle} />
              </label>
              <label className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--muted)" }} title="1 = pick one; more = multi-select add-ons">
                max
                <input type="number" min="1" max="10" value={g.maxSelect} onChange={(e) => upd(gi, { maxSelect: e.target.value })} className={`${INP} w-14`} style={inputStyle} />
              </label>
              <button type="button" onClick={() => onChange(value.filter((_, i) => i !== gi))} className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }} aria-label="Remove group">
                <Trash2 size={14} style={{ color: "var(--clay)" }} />
              </button>
            </div>

            {isOpen && (
              <div className="px-3 pb-3 space-y-2">
                {g.options.map((o, oi) => (
                  <div key={oi} className="rounded-md p-2.5" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                    <div className="grid grid-cols-[1fr_96px_auto_auto] gap-2 items-center">
                      <input value={o.name} onChange={(e) => updOpt(gi, oi, { name: e.target.value })} placeholder="Option (e.g. Quinoa)" className={INP} style={inputStyle} />
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "var(--muted)" }}>±$</span>
                        <input type="number" step="0.25" value={o.priceDelta} onChange={(e) => updOpt(gi, oi, { priceDelta: e.target.value })} placeholder="0.00" title="Price change vs. the meal price (negative allowed)" className={`${INP} pl-6`} style={inputStyle} />
                      </div>
                      <label className="flex items-center gap-1.5 text-[12px] whitespace-nowrap" style={{ color: "var(--ink)" }} title="Pre-selected, and used when no choice is made (POS, subscriptions)">
                        <input type="checkbox" checked={o.isDefault} onChange={(e) => updOpt(gi, oi, { isDefault: e.target.checked })} /> default
                      </label>
                      <button type="button" onClick={() => upd(gi, { options: g.options.filter((_, i) => i !== oi) })} className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} aria-label="Remove option">
                        <Trash2 size={13} style={{ color: "var(--clay)" }} />
                      </button>
                    </div>

                    {/* Allergens this option introduces */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ALLERGENS.map((a) => {
                        const on = o.allergens.includes(a);
                        return (
                          <button key={a} type="button" onClick={() => updOpt(gi, oi, { allergens: on ? o.allergens.filter((x) => x !== a) : [...o.allergens, a] })} className="px-2 py-0.5 rounded text-[10.5px] capitalize" style={{ border: `1px solid ${on ? "var(--clay)" : "var(--line)"}`, color: on ? "var(--clay)" : "var(--muted)", background: on ? "color-mix(in srgb, var(--clay) 8%, transparent)" : "transparent" }}>
                            {a}
                          </button>
                        );
                      })}
                    </div>

                    {/* This option's ingredients */}
                    <div className="mt-2 space-y-1.5">
                      {o.ingredients.map((r, ii) => (
                        <div key={ii} className="grid grid-cols-[1fr_64px_78px_64px_auto] gap-1.5 items-center">
                          <input value={r.name} onChange={(e) => updIng(gi, oi, ii, { name: e.target.value })} placeholder="Ingredient" list="pf-ingredients" autoComplete="off" className={INP} style={inputStyle} />
                          <input type="number" step="0.01" min="0" value={r.qty} onChange={(e) => updIng(gi, oi, ii, { qty: e.target.value })} placeholder="Qty" className={INP} style={inputStyle} />
                          <select value={r.unit} onChange={(e) => updIng(gi, oi, ii, { unit: e.target.value })} className={INP} style={inputStyle}>
                            {UNITS.map((u) => <option key={u}>{u}</option>)}
                          </select>
                          <input type="number" step="0.01" min="0" max="100" value={r.trimPercent} onChange={(e) => updIng(gi, oi, ii, { trimPercent: e.target.value })} placeholder="Trim %" className={INP} style={inputStyle} />
                          <button type="button" onClick={() => updOpt(gi, oi, { ingredients: o.ingredients.filter((_, i) => i !== ii) })} className="grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--line)" }} aria-label="Remove ingredient">
                            <Trash2 size={12} style={{ color: "var(--clay)" }} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => updOpt(gi, oi, { ingredients: [...o.ingredients, blankIng()] })} className="flex items-center gap-1 text-[11.5px] font-medium" style={{ color: "var(--pine)" }}>
                        <Plus size={12} /> Ingredient for this option
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => upd(gi, { options: [...g.options, blankOption()] })} className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--pine)" }}>
                  <Plus size={13} /> Add option
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={() => onChange([...value, blankGroup()])} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}>
        <Plus size={14} /> Add option group
      </button>
    </div>
  );
}

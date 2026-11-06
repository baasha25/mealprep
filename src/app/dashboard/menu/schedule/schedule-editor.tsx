"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Check, Copy, Loader2 } from "lucide-react";
import { formatCents } from "@/lib/money";
import { saveMenuWeek } from "./actions";

export type ScheduleWeek = { weekStartISO: string; label: string; isThisWeek: boolean; mealIds: string[]; note: string };
type Meal = { id: string; name: string; diet: string | null; priceCents: number };

const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;
const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export function ScheduleEditor({ weeks, meals }: { weeks: ScheduleWeek[]; meals: Meal[] }) {
  const [state, setState] = useState<Record<string, { mealIds: string[]; note: string }>>(() => Object.fromEntries(weeks.map((w) => [w.weekStartISO, { mealIds: w.mealIds, note: w.note }])));
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const set = (k: string, patch: Partial<{ mealIds: string[]; note: string }>) => setState((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
  const toggle = (k: string, id: string) =>
    set(k, { mealIds: state[k].mealIds.includes(id) ? state[k].mealIds.filter((x) => x !== id) : [...state[k].mealIds, id] });

  const save = (k: string) => {
    setBusy(k);
    start(async () => {
      const r = await saveMenuWeek({ weekStart: k, mealIds: state[k].mealIds, note: state[k].note });
      setMsg((m) => ({ ...m, [k]: r.message }));
      setBusy(null);
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {weeks.map((w, i) => {
        const cur = state[w.weekStartISO];
        const custom = cur.mealIds.length > 0;
        const prev = i > 0 ? state[weeks[i - 1].weekStartISO] : null;
        return (
          <section key={w.weekStartISO} className="rounded-xl border p-5" style={card}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays size={15} style={{ color: "var(--pine)" }} />
                  <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Week of {w.label}</h3>
                  {w.isThisWeek && <span className="text-[10.5px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--sand)", color: "var(--muted)" }}>this week</span>}
                </div>
                <div className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>{custom ? `${cur.mealIds.length} of ${meals.length} meals on` : "Whole menu"}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {prev && prev.mealIds.length > 0 && (
                  <button type="button" onClick={() => set(w.weekStartISO, { mealIds: prev.mealIds, note: prev.note })} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }} title="Copy the previous week's selection and note">
                    <Copy size={12} /> Copy previous
                  </button>
                )}
                <button type="button" onClick={() => set(w.weekStartISO, { mealIds: custom ? [] : meals.map((m) => m.id) })} className="px-2.5 py-1.5 rounded-md text-[12px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                  {custom ? "Whole menu" : "Pick meals"}
                </button>
              </div>
            </div>

            {custom && (
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                {meals.map((m) => {
                  const on = cur.mealIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-[13px] cursor-pointer py-0.5" style={{ color: on ? "var(--ink)" : "var(--muted)" }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(w.weekStartISO, m.id)} />
                      <span className="truncate">{m.name}</span>
                      <span className="ml-auto text-[11.5px] shrink-0" style={{ color: "var(--muted)" }}>{formatCents(m.priceCents)}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <label className="block">
              <span className="text-[12.5px] font-medium block mb-1" style={{ color: "var(--ink)" }}>From the kitchen (shown on the storefront that week)</span>
              <input value={cur.note} onChange={(e) => set(w.weekStartISO, { note: e.target.value })} maxLength={300} placeholder="e.g. Ontario squash is in, so the Buddha bowl is roasted squash this week." className="w-full px-3 py-2 rounded-md border text-[13px] outline-none" style={inputStyle} />
            </label>

            <div className="flex items-center gap-3 mt-3">
              <button type="button" onClick={() => save(w.weekStartISO)} disabled={pending && busy === w.weekStartISO} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                {pending && busy === w.weekStartISO ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save week
              </button>
              {msg[w.weekStartISO] && <span className="text-[12.5px]" style={{ color: "var(--pine)" }}>{msg[w.weekStartISO]}</span>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

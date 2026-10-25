"use client";

import { useActionState, useState } from "react";
import { MapPinned, Plus, Trash2, Check } from "lucide-react";
import { Card, CardTitle, INP } from "@/components/ui";
import { Hint } from "@/components/ui";
import { saveDeliveryZones, type ZonesActionState } from "./actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export type ZoneRow = { name: string; prefixes: string; days: Record<string, boolean>; feeDollars: string };

/**
 * Delivery zones: name, postal-code prefixes, the day(s) that area is delivered,
 * and its fee. Saved as a set (its own form, outside the main settings form).
 */
export function DeliveryZonesCard({ initial, kitchenDays, defaultFeeDollars }: { initial: ZoneRow[]; kitchenDays: string[]; defaultFeeDollars: number }) {
  const [rows, setRows] = useState<ZoneRow[]>(initial);
  const [state, action, pending] = useActionState<ZonesActionState, FormData>(saveDeliveryZones, null);

  const update = (i: number, patch: Partial<ZoneRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggleDay = (i: number, d: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, days: { ...r.days, [d]: !r.days[d] } } : r)));
  const add = () => setRows((rs) => [...rs, { name: "", prefixes: "", days: {}, feeDollars: "" }]);
  const remove = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  return (
    <Card className="mt-4">
      <div id="zones" className="scroll-mt-6" />
      <CardTitle icon={<MapPinned size={15} />} title="Delivery zones" note={rows.length ? `${rows.length} zone${rows.length === 1 ? "" : "s"}` : "Off — one flat fee, all your delivery days"} />
      <p className="text-[12.5px] mb-4 -mt-2" style={{ color: "var(--muted)" }}>
        Split your delivery area by postal code. Each zone gets its own delivery day(s) and fee; customers are placed automatically from the postal code they type at checkout, and Delivery Routes groups the day&apos;s drops by zone.
        Prefixes are the first characters of a postal code (L4C, L4E, M5V). Longer prefixes win when they overlap. A postal code outside every zone can&apos;t check out for delivery (pickup still works).
      </p>

      <form action={action} className="space-y-3">
        <input type="hidden" name="zones" value={JSON.stringify(rows)} />
        {rows.length === 0 && (
          <p className="text-[13px] rounded-lg px-3.5 py-3" style={{ background: "var(--paper)", border: "1px dashed var(--line)", color: "var(--muted)" }}>
            No zones yet. Your storefront uses your delivery days and one flat fee for everyone.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border p-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto_120px_28px] items-start" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: "var(--muted)" }}>Zone</span>
              <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="North" className={INP} style={inputStyle} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: "var(--muted)" }}>Postal code prefixes <Hint text="The first characters of the postal codes in this area, e.g. L4C, L4E or V6E. Longer prefixes win when two zones overlap." /></span>
              <input value={r.prefixes} onChange={(e) => update(i, { prefixes: e.target.value })} placeholder="L4C, L4E, L4S" className={INP} style={inputStyle} />
            </label>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: "var(--muted)" }}>Delivery day(s)</span>
              <div className="flex flex-wrap gap-1">
                {DAYS.map((d) => {
                  const offered = kitchenDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i, d)}
                      title={offered ? "" : "Not one of your delivery days (Fulfillment above) — you can still assign it to this zone"}
                      className="px-2 py-1 rounded-md text-[11.5px] font-medium border"
                      style={{ borderColor: r.days[d] ? "var(--pine)" : "var(--line)", background: r.days[d] ? "color-mix(in srgb, var(--pine) 12%, transparent)" : "var(--surface)", color: offered || r.days[d] ? "var(--ink)" : "var(--muted)" }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10.5px] block mt-1" style={{ color: "var(--muted)" }}>None ticked = all your delivery days</span>
            </div>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: "var(--muted)" }}>Fee ($) <Hint text="Delivery fee for this zone, charged per order and per subscription week. Blank = your default delivery fee; 0 = free delivery." /></span>
              <input value={r.feeDollars} onChange={(e) => update(i, { feeDollars: e.target.value })} placeholder={defaultFeeDollars.toFixed(2)} inputMode="decimal" className={INP} style={inputStyle} />
              <span className="text-[10.5px] block mt-1" style={{ color: "var(--muted)" }}>Blank = default · 0 = free</span>
            </label>
            <button type="button" onClick={() => remove(i)} aria-label="Remove zone" className="mt-6"><Trash2 size={15} style={{ color: "var(--muted)" }} /></button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={add} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
            <Plus size={14} /> Add zone
          </button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
            {state?.ok ? <Check size={14} /> : null} {pending ? "Saving…" : "Save zones"}
          </button>
          {state && <span className="text-[12.5px]" style={{ color: state.ok ? "var(--pine)" : "var(--clay)" }}>{state.message}</span>}
        </div>
      </form>
    </Card>
  );
}

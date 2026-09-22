"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Check, ChevronDown, ChevronRight, RotateCcw, Printer } from "lucide-react";

export type DispatchStop = { id: string; name: string; address: string | null; items: number };
export type DispatchRoute = { zone: string; stops: DispatchStop[] };

/**
 * Dispatch checklist — the last QA step before bags leave the kitchen.
 * "Mississauga 15 · Markham 11 · Brampton 6": tick each stop as it goes out
 * the door so nothing is missed. Big tap targets for a tablet at the pass;
 * prints as a paper checklist. Ticks persist for the day (per browser) so a
 * refresh doesn't lose progress; a new day starts clean.
 */
export function DispatchCheck({ routes, dateKey }: { routes: DispatchRoute[]; dateKey: string }) {
  const storageKey = `pf_dispatch_${dateKey}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  // Load today's ticks after mount (localStorage is per-viewer; never trusted for anything else).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* best-effort */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...done]));
    } catch {
      /* best-effort */
    }
  }, [done, hydrated, storageKey]);

  const total = useMemo(() => routes.reduce((s, r) => s + r.stops.length, 0), [routes]);
  const doneCount = useMemo(
    () => routes.reduce((s, r) => s + r.stops.filter((st) => done.has(st.id)).length, 0),
    [routes, done],
  );

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setZone = (r: DispatchRoute, value: boolean) =>
    setDone((prev) => {
      const next = new Set(prev);
      for (const st of r.stops) value ? next.add(st.id) : next.delete(st.id);
      return next;
    });

  if (total === 0) return null;
  const allDone = doneCount === total;

  return (
    <div className="rounded-xl border mb-5 print-full" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2">
          <span style={{ color: allDone ? "var(--pine)" : "var(--clay)" }}><ClipboardCheck size={17} /></span>
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Dispatch checklist</h3>
          <span
            className="text-[12px] px-2 py-0.5 rounded-md font-semibold"
            style={{ background: allDone ? "color-mix(in srgb, var(--pine) 12%, transparent)" : "var(--sand)", color: allDone ? "var(--pine)" : "var(--ink-soft)" }}
          >
            {doneCount} / {total} out the door
          </span>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Printer size={13} /> Print
          </button>
          <button
            onClick={() => setDone(new Set())}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
            title="Clear all ticks"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Zone summary rows — the "Mississauga 15 · Markham 11" view */}
      <div className="divide-y" style={{ borderColor: "var(--line)" }}>
        {routes.map((r) => {
          const zDone = r.stops.filter((st) => done.has(st.id)).length;
          const zAll = zDone === r.stops.length;
          const isOpen = open[r.zone] ?? false;
          return (
            <div key={r.zone}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => setOpen((o) => ({ ...o, [r.zone]: !isOpen }))}
                  className="no-print grid place-items-center w-7 h-7 rounded-md shrink-0"
                  style={{ color: "var(--muted)" }}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{r.zone}</span>
                    <span className="text-[12.5px]" style={{ color: zAll ? "var(--pine)" : "var(--muted)" }}>
                      {zDone} / {r.stops.length} stop{r.stops.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--sand)" }}>
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(zDone / r.stops.length) * 100}%`, background: zAll ? "var(--pine)" : "var(--clay)" }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => setZone(r, !zAll)}
                  className="no-print px-2.5 py-1.5 rounded-lg text-[12px] font-medium border shrink-0"
                  style={{ borderColor: zAll ? "var(--pine)" : "var(--line)", color: zAll ? "var(--pine)" : "var(--ink-soft)" }}
                >
                  {zAll ? "Zone done ✓" : "Mark zone done"}
                </button>
              </div>

              {/* Stops — expanded on screen when opened; always expanded when printing */}
              <div className={isOpen ? "" : "hidden print:block"}>
                <div className="px-4 pb-3 space-y-1.5">
                  {r.stops.map((st) => {
                    const on = done.has(st.id);
                    return (
                      <button
                        key={st.id}
                        onClick={() => toggle(st.id)}
                        aria-pressed={on}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left"
                        style={{
                          background: on ? "color-mix(in srgb, var(--pine) 8%, transparent)" : "var(--paper)",
                          border: `1px solid ${on ? "var(--pine)" : "var(--line)"}`,
                          minHeight: 44, // tablet tap target
                        }}
                      >
                        <span
                          className="grid place-items-center w-6 h-6 rounded-md shrink-0"
                          style={{ border: `2px solid ${on ? "var(--pine)" : "var(--muted)"}`, background: on ? "var(--pine)" : "transparent", color: "#f4f2ec" }}
                        >
                          {on && <Check size={14} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13.5px] font-medium" style={{ color: "var(--ink)", textDecoration: on ? "line-through" : "none", opacity: on ? 0.7 : 1 }}>
                            {st.name}
                          </span>
                          <span className="block text-[12px] truncate" style={{ color: "var(--muted)" }}>{st.address ?? "No address on file"}</span>
                        </span>
                        <span className="text-[12px] shrink-0" style={{ color: "var(--ink-soft)" }}>{st.items} meals · #{st.id.slice(-6)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

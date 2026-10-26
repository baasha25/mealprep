"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Check, Undo2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { endPriceTest } from "./price-test-actions";
import type { ExperimentView } from "@/lib/price-test-data";

const fmtDay = (d: Date | string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n}%`);

/** Running and decided price tests, with the live verdict and the keep / revert decision. */
export function PriceTests({ experiments }: { experiments: ExperimentView[] }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  if (experiments.length === 0) return null;
  const tone = (r: string) => (r === "keep" ? "var(--pine)" : r === "revert" ? "var(--clay)" : "var(--muted)");
  return (
    <Card className="mb-5">
      <CardTitle icon={<FlaskConical size={15} />} title="Price tests" note={`${experiments.filter((e) => e.status === "running").length} running`} />
      <p className="text-[12.5px] mb-3 -mt-2" style={{ color: "var(--muted)" }}>
        A test puts one meal at a new price for 7 or 14 days and compares sales per day and contribution per day (price minus plate cost) with the same-length window before. Decide with the numbers, not a hunch.
      </p>
      {note && <p className="text-[12.5px] mb-3 px-3 py-2 rounded-md" style={{ background: note.ok ? "color-mix(in srgb, var(--pine) 9%, transparent)" : "color-mix(in srgb, var(--clay) 10%, transparent)", color: note.ok ? "var(--pine)" : "var(--clay)" }}>{note.message}</p>}
      <div className="space-y-2.5">
        {experiments.map((e) => {
          const v = e.verdict;
          const running = e.status === "running";
          return (
            <div key={e.id} className="rounded-lg px-3.5 py-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                    {e.mealName} <span style={{ color: "var(--muted)" }}>{formatCents(e.basePriceCents)} → </span><span style={{ color: "var(--pine)" }}>{formatCents(e.testPriceCents)}</span>
                  </div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {fmtDay(e.startAt)} – {fmtDay(e.endAt)} · {running ? `day ${Math.min(e.baselineDays, Math.floor(e.testDays) + 1)} of ${e.baselineDays}` : e.status === "kept" ? "kept the new price" : "reverted"}
                  </div>
                </div>
                <span className="text-[11.5px] px-2 py-0.5 rounded-full font-medium" style={{ background: `color-mix(in srgb, ${tone(v.recommendation)} 12%, transparent)`, color: tone(v.recommendation) }}>
                  {v.recommendation === "keep" ? "Keep the new price" : v.recommendation === "revert" ? "Go back" : "Too early to call"}
                </span>
              </div>
              <div className="grid sm:grid-cols-4 gap-2 mt-2.5 text-[12px]">
                <div><div style={{ color: "var(--muted)" }}>Sold / day</div><div style={{ color: "var(--ink)" }}>{v.baselineUnitsPerDay.toFixed(1)} → {v.testUnitsPerDay.toFixed(1)} <span style={{ color: "var(--muted)" }}>({pct(v.unitsChangePct)})</span></div></div>
                <div><div style={{ color: "var(--muted)" }}>Contribution / day</div><div style={{ color: "var(--ink)" }}>{formatCents(v.baselineContribPerDay)} → {formatCents(v.testContribPerDay)} <span style={{ color: "var(--muted)" }}>({pct(v.contribChangePct)})</span></div></div>
                <div><div style={{ color: "var(--muted)" }}>Sold in test</div><div style={{ color: "var(--ink)" }}>{e.testUnits} in {Math.floor(e.testDays)} day{Math.floor(e.testDays) === 1 ? "" : "s"}</div></div>
                <div><div style={{ color: "var(--muted)" }}>Baseline</div><div style={{ color: "var(--ink)" }}>{e.baselineUnits} in {e.baselineDays} days</div></div>
              </div>
              <p className="text-[12px] mt-2" style={{ color: "var(--ink-soft)" }}>{v.reason}</p>
              {running && (
                <div className="flex items-center gap-2 mt-2.5">
                  <button type="button" disabled={pending} onClick={() => start(async () => setNote(await endPriceTest(e.id, "keep")))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium disabled:opacity-50" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                    <Check size={13} /> Keep {formatCents(e.testPriceCents)}
                  </button>
                  <button type="button" disabled={pending} onClick={() => start(async () => setNote(await endPriceTest(e.id, "revert")))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border disabled:opacity-50" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    <Undo2 size={13} /> Back to {formatCents(e.basePriceCents)}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

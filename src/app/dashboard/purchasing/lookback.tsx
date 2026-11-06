import Link from "next/link";
import { History, Receipt } from "lucide-react";
import { Card, Hint } from "@/components/ui";
import { formatCents, bpsToPercent } from "@/lib/money";
import { LOOKBACK_DAYS, type LookbackDays } from "@/lib/purchasing-lookback-data";
import type { Lookback } from "@/lib/purchasing-lookback";

/**
 * "Looking back": what the kitchen bought beyond what its orders needed, from
 * logged deliveries and scanned invoices vs. the gross need of orders sold.
 * The number a prospect asks for first; honest about what it can't see.
 */
export function LookbackSection({ lb, days }: { lb: Lookback; days: LookbackDays }) {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const top = lb.rows.filter((r) => r.surplusCents > 0).slice(0, 8);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="flex items-center gap-2">
            <History size={16} style={{ color: "var(--pine)" }} />
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Looking back: bought beyond what orders needed
            </h3>
            <Hint text="Every delivery you logged (Receive stock, or a scanned invoice) in the window, compared with what the orders you sold in the same window needed after trim. Surplus is priced at what you actually paid. Shortfalls are shown but never netted off: stock from before the window explains them, not savings." />
          </div>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
            From {lb.receiptCount} logged deliver{lb.receiptCount === 1 ? "y" : "ies"} across {lb.judgedIngredients} ingredient{lb.judgedIngredients === 1 ? "" : "s"}. Orders count by the day they were placed, imported history included.
          </p>
        </div>
        <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          {LOOKBACK_DAYS.map((d) => (
            <Link key={d} href={d === 90 ? "/dashboard/purchasing" : `/dashboard/purchasing?back=${d}`} className="px-3 py-1.5 rounded-md text-[12.5px] font-medium" style={{ background: days === d ? "var(--pine)" : "transparent", color: days === d ? "#f4f2ec" : "var(--muted)" }}>
              {d} days
            </Link>
          ))}
        </div>
      </div>

      {lb.receiptCount === 0 ? (
        <div className="rounded-lg px-4 py-4 text-[13px]" style={{ background: "var(--paper)", border: "1px dashed var(--line)", color: "var(--ink-soft)" }}>
          <div className="flex items-center gap-2 font-medium" style={{ color: "var(--ink)" }}><Receipt size={14} /> No deliveries logged in the last {days} days, so there is nothing to compare yet.</div>
          <p className="mt-1.5">Log what arrives and this fills in: <Link href="/dashboard/inventory" className="font-medium" style={{ color: "var(--pine)" }}>Inventory → Receive stock</Link> for each delivery, or photograph the supplier invoice with the scanner (Pro). Two or three weeks of deliveries is enough for a first number; six months of orders from your old platform makes it real on day one.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg px-4 py-3" style={{ background: "color-mix(in srgb, var(--clay) 9%, var(--surface))", border: "1px solid color-mix(in srgb, var(--clay) 30%, transparent)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--clay)" }}>Over-bought, {days} days</div>
              <div className="disp text-[26px] font-medium leading-tight" style={{ color: "var(--clay)" }}>{formatCents(lb.overBoughtCents)}</div>
              <div className="text-[12px]" style={{ color: "var(--ink-soft)" }}>{bpsToPercent(lb.overBoughtBps).toFixed(1)}% of what you bought</div>
            </div>
            <div className="rounded-lg px-4 py-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Bought (logged)</div>
              <div className="disp text-[26px] font-medium leading-tight" style={{ color: "var(--ink)" }}>{formatCents(lb.boughtCents)}</div>
              <div className="text-[12px]" style={{ color: "var(--ink-soft)" }}>{lb.receiptCount} deliveries</div>
            </div>
            <div className="rounded-lg px-4 py-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>A year at this rate</div>
              <div className="disp text-[26px] font-medium leading-tight" style={{ color: "var(--ink)" }}>{formatCents(Math.round((lb.overBoughtCents * 365) / days))}</div>
              <div className="text-[12px]" style={{ color: "var(--ink-soft)" }}>if nothing changes</div>
            </div>
          </div>

          {top.length > 0 ? (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", background: "var(--paper)", borderBottom: "1px solid var(--line)" }}>
                <div>Ingredient</div><div className="text-right">Bought</div><div className="text-right">Orders needed</div><div className="text-right">Surplus</div><div className="text-right">Over-bought</div>
              </div>
              {top.map((r) => (
                <div key={r.ingredientId} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-[13px] items-center" style={{ borderBottom: "1px solid var(--line)", color: "var(--ink)" }}>
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-right" style={{ color: "var(--ink-soft)" }}>{round1(r.boughtQty)} {r.unit}</div>
                  <div className="text-right" style={{ color: "var(--ink-soft)" }}>{round1(r.neededQty)} {r.unit}</div>
                  <div className="text-right" style={{ color: "var(--ink-soft)" }}>{round1(r.surplusQty)} {r.unit}</div>
                  <div className="text-right font-semibold" style={{ color: "var(--clay)" }}>{formatCents(r.surplusCents)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--ink-soft)" }}>Nothing you logged in this window exceeded what your orders needed. 🎉</p>
          )}

          {lb.unjudged.length > 0 && (
            <p className="text-[12px] mt-3" style={{ color: "var(--muted)" }}>
              Not judged (no logged delivery in the window): {lb.unjudged.slice(0, 6).map((u) => u.name).join(", ")}{lb.unjudged.length > 6 ? ` and ${lb.unjudged.length - 6} more` : ""}. Log those deliveries too and they join the comparison.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

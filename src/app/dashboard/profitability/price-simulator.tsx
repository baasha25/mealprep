"use client";

import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { mealEconomics } from "@/lib/profitability";
import { formatCents, bpsToPercent } from "@/lib/money";
import { Card, CardTitle } from "@/components/ui";

export type SimMeal = { id: string; name: string; priceCents: number; costCents: number; units: number; hasRecipe: boolean };

/**
 * "What if I charged $X?" — moves one meal's price and shows margin, projected
 * contribution over the period's real volume, and the break-even units if
 * customers buy fewer at the higher price. Pure client math on numbers the
 * page already computed; nothing is saved.
 */
export function PriceSimulator({ meals, rangeLabel }: { meals: SimMeal[]; rangeLabel: string }) {
  const costed = meals.filter((m) => m.hasRecipe && m.costCents > 0);
  const first = costed.slice().sort((a, b) => b.units - a.units)[0];
  const [mealId, setMealId] = useState(first?.id ?? "");
  const meal = costed.find((m) => m.id === mealId) ?? first;
  const [price, setPrice] = useState<string>(meal ? (meal.priceCents / 100).toFixed(2) : "");
  const [unitsPct, setUnitsPct] = useState(0);

  const sim = useMemo(() => {
    if (!meal) return null;
    const newPrice = Math.max(0, Math.round(Number(price || 0) * 100));
    const cur = mealEconomics(meal.priceCents, meal.costCents);
    const nxt = mealEconomics(newPrice, meal.costCents);
    const projUnits = Math.max(0, Math.round(meal.units * (1 + unitsPct / 100)));
    const curContribution = cur.marginCents * meal.units;
    const newContribution = nxt.marginCents * projUnits;
    const breakEvenUnits = nxt.marginCents > 0 ? Math.ceil(curContribution / nxt.marginCents) : null;
    return { newPrice, cur, nxt, projUnits, curContribution, newContribution, delta: newContribution - curContribution, breakEvenUnits };
  }, [meal, price, unitsPct]);

  if (!meal || !sim) return null;

  const pick = (id: string) => {
    const m = costed.find((x) => x.id === id);
    setMealId(id);
    if (m) setPrice((m.priceCents / 100).toFixed(2));
    setUnitsPct(0);
  };
  const pct = (bps: number) => `${bpsToPercent(bps).toFixed(1)}%`;
  const minP = Math.max(0.5, meal.priceCents * 0.7) / 100;
  const maxP = (meal.priceCents * 1.4) / 100;

  return (
    <Card>
      <CardTitle icon={<FlaskConical size={15} />} title="What-if price simulator" note={`Volume from ${rangeLabel.toLowerCase()} · nothing is saved`} />
      <div className="grid md:grid-cols-[1fr_1.4fr] gap-5">
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>Meal</span>
            <select value={meal.id} onChange={(e) => pick(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border text-[13.5px]" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}>
              {costed.map((m) => <option key={m.id} value={m.id}>{m.name} — {formatCents(m.priceCents)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>New price</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[13px]" style={{ color: "var(--muted)" }}>$</span>
              <input type="number" step="0.25" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-28 px-3 py-2 rounded-lg border text-[13.5px]" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} />
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>now {formatCents(meal.priceCents)}</span>
            </div>
            <input type="range" min={minP} max={maxP} step={0.25} value={Number(price) || 0} onChange={(e) => setPrice(Number(e.target.value).toFixed(2))} className="w-full mt-2" />
          </label>
          <label className="block">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>If sales change by <strong style={{ color: "var(--ink)" }}>{unitsPct > 0 ? "+" : ""}{unitsPct}%</strong></span>
            <input type="range" min={-50} max={50} step={5} value={unitsPct} onChange={(e) => setUnitsPct(Number(e.target.value))} className="w-full mt-1" />
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>Raising price often costs a little volume — drag to see where it still pays.</span>
          </label>
        </div>

        <div className="rounded-lg p-4" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <div className="grid grid-cols-3 gap-2 text-[12px] mb-3" style={{ color: "var(--muted)" }}>
            <div />
            <div className="text-right font-semibold uppercase tracking-wide text-[10.5px]">Now</div>
            <div className="text-right font-semibold uppercase tracking-wide text-[10.5px]" style={{ color: "var(--pine)" }}>What-if</div>
          </div>
          {[
            ["Price", formatCents(meal.priceCents), formatCents(sim.newPrice)],
            ["Plate cost", formatCents(meal.costCents), formatCents(meal.costCents)],
            ["Margin / plate", formatCents(sim.cur.marginCents), formatCents(sim.nxt.marginCents)],
            ["Margin %", pct(sim.cur.marginBps), pct(sim.nxt.marginBps)],
            ["Units", String(meal.units), String(sim.projUnits)],
          ].map(([l, a, b]) => (
            <div key={l} className="grid grid-cols-3 gap-2 text-[13px] py-1.5" style={{ borderTop: "1px solid var(--line)" }}>
              <span style={{ color: "var(--ink-soft)" }}>{l}</span>
              <span className="text-right tabular-nums" style={{ color: "var(--ink)" }}>{a}</span>
              <span className="text-right tabular-nums font-medium" style={{ color: sim.nxt.losing ? "var(--clay)" : "var(--ink)" }}>{b}</span>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 items-baseline pt-3 mt-1" style={{ borderTop: "2px solid var(--line)" }}>
            <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Contribution</span>
            <span className="text-right tabular-nums text-[13px]" style={{ color: "var(--ink)" }}>{formatCents(sim.curContribution)}</span>
            <span className="text-right">
              <span className="disp text-[17px] font-medium tabular-nums" style={{ color: sim.delta >= 0 ? "var(--pine)" : "var(--clay)" }}>{formatCents(sim.newContribution)}</span>
              <span className="block text-[11px]" style={{ color: sim.delta >= 0 ? "var(--pine)" : "var(--clay)" }}>{sim.delta >= 0 ? "+" : "−"}{formatCents(Math.abs(sim.delta))}</span>
            </span>
          </div>
          <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>
            {sim.nxt.losing
              ? "At this price the meal loses money on every plate."
              : sim.breakEvenUnits != null && sim.newPrice > meal.priceCents
                ? `You'd only need to sell ${sim.breakEvenUnits} (vs ${meal.units}) to keep today's contribution — you can lose ${meal.units > 0 ? Math.max(0, Math.round((1 - sim.breakEvenUnits / meal.units) * 100)) : 0}% of volume and still come out even.`
                : sim.breakEvenUnits != null && sim.newPrice < meal.priceCents
                  ? `At the lower price you'd need ${sim.breakEvenUnits} sales (vs ${meal.units}) just to match today's contribution.`
                  : "Move the price to see the effect."}
          </p>
        </div>
      </div>
    </Card>
  );
}

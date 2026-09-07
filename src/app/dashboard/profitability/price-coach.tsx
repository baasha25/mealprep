"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { formatCents, bpsToPercent } from "@/lib/money";
import { suggestedPriceCents } from "@/lib/profitability";

export type CoachMeal = {
  id: string;
  name: string;
  priceCents: number;
  costCents: number;
  marginBps: number;
  hasRecipe: boolean;
  losing: boolean;
};

const TARGETS = [
  { bps: 6000, label: "60%" },
  { bps: 6500, label: "65%" },
  { bps: 7000, label: "70%" },
] as const;

/**
 * Target-margin price coach: for a chosen target margin, suggests the price each
 * meal needs to hit it, surfacing the ones currently priced below target (and
 * money-losing meals first). Pure margin math on your real costs — no market
 * guesses. (Competitor price scans / live price A/B tests are a separate, larger
 * build that needs external data and are intentionally not here.)
 */
export function PriceCoach({ meals }: { meals: CoachMeal[] }) {
  const [target, setTarget] = useState<number>(6500);

  const rows = meals
    .filter((m) => m.hasRecipe && m.costCents > 0)
    .map((m) => {
      const suggested = suggestedPriceCents(m.costCents, target);
      return { ...m, suggested, gap: suggested - m.priceCents };
    })
    .filter((r) => r.gap > 0) // below the target — the actionable ones
    .sort((a, b) => (a.losing === b.losing ? b.gap - a.gap : a.losing ? -1 : 1));

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--pine)" }} />
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Price coach</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>Target margin</span>
          <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)" }}>
            {TARGETS.map((t) => (
              <button
                key={t.bps}
                onClick={() => setTarget(t.bps)}
                className="px-2.5 py-1 rounded-md text-[12px] font-medium"
                style={{ background: target === t.bps ? "var(--pine)" : "transparent", color: target === t.bps ? "#f4f2ec" : "var(--muted)" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        The price each meal needs to hit a {bpsToPercent(target).toFixed(0)}% margin on your real ingredient
        cost. Money-losing meals are shown first.
      </p>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] px-3 py-4 rounded-lg" style={{ background: "var(--paper)", color: "var(--pine)" }}>
          <Check size={16} /> Every meal with a recipe already meets a {bpsToPercent(target).toFixed(0)}% margin. Nice.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            <span>Meal</span>
            <span className="text-right">Now</span>
            <span className="text-right">Suggested</span>
            <span className="text-right">Change</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2 rounded-lg"
              style={{ background: "var(--paper)", border: `1px solid ${r.losing ? "color-mix(in srgb, var(--clay) 30%, transparent)" : "var(--line)"}` }}
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.name}</div>
                <div className="text-[11px]" style={{ color: r.losing ? "var(--clay)" : "var(--muted)" }}>
                  {r.losing ? "Losing money — " : ""}now {bpsToPercent(r.marginBps).toFixed(0)}% margin
                </div>
              </div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>{formatCents(r.priceCents)}</div>
              <div className="flex items-center gap-1 justify-end text-[13px] font-semibold" style={{ color: "var(--pine)" }}>
                <ArrowRight size={12} /> {formatCents(r.suggested)}
              </div>
              <div className="text-[12.5px] text-right font-medium" style={{ color: "var(--ink)" }}>
                +{formatCents(r.gap)}
              </div>
            </div>
          ))}
          <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            Suggestions are a starting point — check what your market will bear before raising a price. Edit prices in Menu.
          </p>
        </div>
      )}
    </div>
  );
}

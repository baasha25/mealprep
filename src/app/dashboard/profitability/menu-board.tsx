import { MENU_CLASS_LABEL, menuMedians, type MenuClass } from "@/lib/profitability";
import { bpsToPercent, formatCents } from "@/lib/money";
import { Card, CardTitle } from "@/components/ui";

export const CLASS_STYLE: Record<MenuClass, { fg: string; bg: string; blurb: string; action: string }> = {
  star: { fg: "#2f5e3f", bg: "#d9ead9", blurb: "High margin, popular", action: "Protect it: keep quality consistent, feature it first, never discount it." },
  plowhorse: { fg: "#8a6d1f", bg: "#f3e9c9", blurb: "Popular but thin margin", action: "Nudge price up a little or re-cost the recipe (cheaper protein, smaller trim)." },
  puzzle: { fg: "#3f5c5a", bg: "#d6e4e3", blurb: "High margin, low sales", action: "Sell it harder: better photo, top of menu, pair it in a plan." },
  dog: { fg: "#7a7268", bg: "#e7e3d8", blurb: "Low margin, low sales", action: "Fix the recipe or retire it — every dog costs you menu space." },
};

export type BoardRow = { id: string; name: string; marginBps: number; units: number; menuClass: MenuClass; contributionCents: number };

// Quadrant layout: margin up the side, popularity across the bottom.
const QUADRANTS: MenuClass[][] = [
  ["puzzle", "star"],
  ["dog", "plowhorse"],
];

/**
 * The menu-engineering board: a 2×2 quadrant with every costed meal placed by
 * margin (vertical) and popularity (horizontal), plus the same meals listed per
 * quadrant with the action that quadrant calls for.
 */
export function MenuBoard({ rows, rangeLabel }: { rows: BoardRow[]; rangeLabel: string }) {
  if (rows.length === 0) return null;
  const med = menuMedians(rows);
  const maxUnits = Math.max(1, ...rows.map((r) => r.units));
  const maxMargin = Math.max(1, ...rows.map((r) => Math.max(0, r.marginBps)));
  const x = (u: number) => `${Math.min(97, Math.max(3, (u / maxUnits) * 100))}%`;
  const y = (m: number) => `${Math.min(97, Math.max(3, (Math.max(0, m) / maxMargin) * 100))}%`;

  return (
    <Card>
      <CardTitle title="Menu engineering board" note={`Margin × popularity · ${rangeLabel.toLowerCase()}`} />

      {/* Scatter — one dot per meal, crosshair at the menu medians */}
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-5 items-start">
        <div>
          <div className="relative rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--paper)", aspectRatio: "1 / 1" }}>
            {/* quadrant tints */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
              {QUADRANTS.flat().map((k) => (
                <div key={k} className="p-2 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${CLASS_STYLE[k].bg}55`, color: CLASS_STYLE[k].fg }}>
                  {MENU_CLASS_LABEL[k]}
                </div>
              ))}
            </div>
            {/* median crosshair */}
            <div className="absolute inset-y-0 pointer-events-none" style={{ left: x(med.units), width: 1, background: "var(--ink)", opacity: 0.25 }} />
            <div className="absolute inset-x-0 pointer-events-none" style={{ bottom: y(med.marginBps), height: 1, background: "var(--ink)", opacity: 0.25 }} />
            {/* dots */}
            {rows.map((r) => (
              <div
                key={r.id}
                title={`${r.name} — ${bpsToPercent(r.marginBps).toFixed(0)}% margin · ${r.units} sold`}
                className="absolute -translate-x-1/2 translate-y-1/2 rounded-full border-2"
                style={{
                  left: x(r.units), bottom: y(r.marginBps),
                  width: 12 + Math.min(14, Math.round((r.contributionCents / Math.max(1, Math.max(...rows.map((q) => q.contributionCents)))) * 14)),
                  height: 12 + Math.min(14, Math.round((r.contributionCents / Math.max(1, Math.max(...rows.map((q) => q.contributionCents)))) * 14)),
                  background: CLASS_STYLE[r.menuClass].bg, borderColor: CLASS_STYLE[r.menuClass].fg,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10.5px] mt-1" style={{ color: "var(--muted)" }}>
            <span>↑ margin · → sold</span>
            <span>lines = menu medians · dot size = contribution</span>
          </div>
        </div>

        {/* Per-quadrant lists with the action */}
        <div className="grid sm:grid-cols-2 gap-3">
          {(["star", "plowhorse", "puzzle", "dog"] as MenuClass[]).map((k) => {
            const list = rows.filter((r) => r.menuClass === k).sort((a, b) => b.contributionCents - a.contributionCents);
            const cs = CLASS_STYLE[k];
            return (
              <div key={k} className="rounded-lg p-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ background: cs.bg, color: cs.fg }}>{MENU_CLASS_LABEL[k]}</span>
                  <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>{list.length}</span>
                </div>
                <div className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>{cs.blurb} — <span style={{ color: "var(--ink-soft)" }}>{cs.action}</span></div>
                {list.length === 0 ? (
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>None right now.</div>
                ) : (
                  <ul className="space-y-1">
                    {list.slice(0, 6).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate" style={{ color: "var(--ink)" }}>{r.name}</span>
                        <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>{bpsToPercent(r.marginBps).toFixed(0)}% · {r.units} sold · {formatCents(r.contributionCents)}</span>
                      </li>
                    ))}
                    {list.length > 6 && <li className="text-[11px]" style={{ color: "var(--muted)" }}>+{list.length - 6} more</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

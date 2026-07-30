import { TrendingUp, DollarSign, AlertTriangle, ChefHat, ArrowUpRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle, Row } from "@/components/ui";
import { formatCents, bpsToPercent } from "@/lib/money";
import { costPerUnitFromReceipt } from "@/lib/inventory";
import { revenueStatusWhere } from "@/lib/order-status";
import { RangeFilter } from "@/components/range-filter";
import { toRangeKey, rangeWhere, rangeLabel } from "@/lib/date-range";
import { summarizeLosses, LOSS_REASON_META, type LossReason } from "@/lib/loss";
import {
  plateCostCents,
  mealEconomics,
  classifyMenu,
  priceChangeBps,
  MENU_CLASS_LABEL,
  type MenuClass,
} from "@/lib/profitability";

const CLASS_STYLE: Record<MenuClass, { fg: string; bg: string; blurb: string }> = {
  star: { fg: "#2f5e3f", bg: "#d9ead9", blurb: "High margin, popular — promote & protect" },
  plowhorse: { fg: "#8a6d1f", bg: "#f3e9c9", blurb: "Popular but thin margin — reprice or re-cost" },
  puzzle: { fg: "#3f5c5a", bg: "#d6e4e3", blurb: "High margin, low sales — feature it" },
  dog: { fg: "#7a7268", bg: "#e7e3d8", blurb: "Low margin, low sales — fix or cut" },
};

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business } = await requireOwner();
  const range = toRangeKey((await searchParams).range);

  const meals = await db.meal.findMany({
    where: { businessId: business.id, active: true },
    select: {
      id: true,
      name: true,
      priceCents: true,
      ingredients: { select: { qty: true, trimBps: true, ingredient: { select: { costPerUnitCents: true } } } },
    },
  });

  // Sold line items in range (earned revenue only) → units + revenue per meal.
  const soldItems = await db.orderItem.findMany({
    where: { order: { businessId: business.id, ...rangeWhere(range), ...revenueStatusWhere }, mealId: { not: null } },
    select: { mealId: true, qty: true, unitPriceCentsSnapshot: true },
  });
  const unitsByMeal = new Map<string, number>();
  const revenueByMeal = new Map<string, number>();
  for (const it of soldItems) {
    const id = it.mealId as string;
    unitsByMeal.set(id, (unitsByMeal.get(id) ?? 0) + it.qty);
    revenueByMeal.set(id, (revenueByMeal.get(id) ?? 0) + it.qty * it.unitPriceCentsSnapshot);
  }

  const base = meals.map((m) => {
    const cost = plateCostCents(
      m.ingredients.map((mi) => ({ qty: mi.qty, trimBps: mi.trimBps, costPerUnitCents: mi.ingredient.costPerUnitCents })),
    );
    const econ = mealEconomics(m.priceCents, cost);
    const units = unitsByMeal.get(m.id) ?? 0;
    return { id: m.id, name: m.name, priceCents: m.priceCents, costCents: cost, ...econ, units, contributionCents: econ.marginCents * units };
  });
  const rows = classifyMenu(base).sort((a, b) => b.contributionCents - a.contributionCents);

  const losers = rows.filter((r) => r.losing).length;
  const avgMarginBps = rows.length ? Math.round(rows.reduce((s, r) => s + r.marginBps, 0) / rows.length) : 0;
  const avgFoodCostBps = rows.length ? Math.round(rows.reduce((s, r) => s + r.foodCostBps, 0) / rows.length) : 0;

  // ---- True P&L (period): food revenue − food cost (COGS) − recorded losses ----
  const foodRevenueCents = rows.reduce((s, r) => s + (revenueByMeal.get(r.id) ?? 0), 0);
  const foodCostCents = rows.reduce((s, r) => s + r.costCents * r.units, 0);
  const grossMarginCents = foodRevenueCents - foodCostCents;

  const lossRows = await db.lossEvent.findMany({
    where: { businessId: business.id, ...rangeWhere(range) },
    select: { reason: true, costCents: true, qty: true },
  });
  const { totalCents: lossCents, byReason: lossByReason } = summarizeLosses(
    lossRows.map((l) => ({ reason: l.reason as LossReason, costCents: l.costCents, qty: l.qty })),
  );
  const netContributionCents = grossMarginCents - lossCents;
  const lossShareBps = grossMarginCents > 0 ? Math.round((lossCents / grossMarginCents) * 10000) : 0;

  // The menu table's contribution column is menu-margin (pre-loss).
  const totalContribution = rows.reduce((s, r) => s + r.contributionCents, 0);

  // Ingredient price-rise alerts from receipts (latest vs previous cost/unit).
  const priced = await db.ingredient.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      name: true,
      receipts: { orderBy: { receivedAt: "desc" }, take: 2, select: { qtyReceived: true, totalCostCents: true } },
      mealIngredients: { select: { meal: { select: { name: true, active: true } } } },
    },
  });
  const alerts = priced
    .map((ing) => {
      if (ing.receipts.length < 2) return null;
      const [newer, older] = ing.receipts;
      const newCost = costPerUnitFromReceipt(newer.totalCostCents, newer.qtyReceived);
      const oldCost = costPerUnitFromReceipt(older.totalCostCents, older.qtyReceived);
      const changeBps = priceChangeBps(oldCost, newCost);
      if (changeBps < 300) return null; // only meaningful rises (≥3%)
      const affected = [...new Set(ing.mealIngredients.filter((mi) => mi.meal.active).map((mi) => mi.meal.name))];
      return { name: ing.name, changeBps, affected };
    })
    .filter(Boolean)
    .sort((a, b) => b!.changeBps - a!.changeBps) as { name: string; changeBps: number; affected: string[] }[];

  return (
    <Page>
      <Head
        kicker="Profit"
        title="Profitability & P&L"
        sub={`What each plate costs, what it earns, and your true bottom line after losses — ${rangeLabel(range).toLowerCase()}.`}
        right={<RangeFilter basePath="/dashboard/profitability" current={range} />}
      />

      {/* True P&L: food revenue − food cost − recorded losses */}
      <Card className="mb-5">
        <CardTitle icon={<DollarSign size={15} />} title="Profit & loss" note={rangeLabel(range)} />
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-x-8 gap-y-1.5">
          <div className="space-y-1.5 text-[13px]">
            <Row l="Food revenue (menu sales)" v={formatCents(foodRevenueCents)} />
            <Row l="Food cost (COGS)" v={`−${formatCents(foodCostCents)}`} />
            <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>Gross margin</span>
              <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{formatCents(grossMarginCents)}</span>
            </div>
            <Row l="Recorded food loss" v={`−${formatCents(lossCents)}`} />
            <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Net contribution</span>
              <span className="disp text-[18px] font-medium" style={{ color: netContributionCents >= 0 ? "var(--pine)" : "var(--clay)" }}>
                {formatCents(netContributionCents)}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Loss by cause</span>
              <Link href="/dashboard/waste" className="text-[11.5px] inline-flex items-center gap-1" style={{ color: "var(--pine)" }}>
                <Trash2 size={12} /> Waste log
              </Link>
            </div>
            {lossByReason.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>No losses logged this period. 🎉</p>
            ) : (
              <div className="space-y-2">
                {lossByReason.map((r) => {
                  const meta = LOSS_REASON_META[r.reason];
                  const pct = lossCents ? Math.round((r.costCents / lossCents) * 100) : 0;
                  return (
                    <div key={r.reason}>
                      <div className="flex justify-between items-center text-[12px] mb-1">
                        <span className="text-[10.5px] px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                        <span style={{ color: "var(--ink-soft)" }}>{formatCents(r.costCents)}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--sand)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: "var(--clay)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>
          Revenue and cost cover meals sold in the period (canceled/refunded excluded). Food loss is what you logged in Waste &amp; Loss{lossCents > 0 ? ` — eating ${bpsToPercent(lossShareBps).toFixed(1)}% of your gross margin` : ""}. This is contribution before labour, packaging, rent, and platform fees.
        </p>
      </Card>

      <div className="grid sm:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<TrendingUp size={16} />} label="Avg margin" value={`${bpsToPercent(avgMarginBps).toFixed(1)}%`} />
        <Kpi icon={<DollarSign size={16} />} label="Avg food cost" value={`${bpsToPercent(avgFoodCostBps).toFixed(1)}%`} />
        <Kpi icon={<ChefHat size={16} />} label="Menu contribution (pre-loss)" value={formatCents(totalContribution)} />
        <Kpi icon={<AlertTriangle size={16} />} label="Money-losing meals" value={losers} />
      </div>

      {alerts.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg mb-5" style={{ background: "color-mix(in srgb, var(--clay) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--clay) 22%, transparent)" }}>
          <ArrowUpRight size={16} style={{ color: "var(--clay)", marginTop: 1 }} />
          <div className="text-[13px]" style={{ color: "var(--ink)" }}>
            <strong>Ingredient costs are rising.</strong>{" "}
            {alerts.map((a) => (
              <span key={a.name}>
                {a.name} <span style={{ color: "var(--clay)" }}>+{bpsToPercent(a.changeBps).toFixed(1)}%</span>
                {a.affected.length ? ` (${a.affected.length} meal${a.affected.length === 1 ? "" : "s"})` : ""}.{" "}
              </span>
            ))}
            Margins on affected meals are dropping — reprice or re-source.
          </div>
        </div>
      )}

      {/* Profitability table */}
      <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="hidden sm:grid grid-cols-[1.5fr_80px_80px_90px_70px_70px_110px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
          <div>Meal</div>
          <div className="text-right">Price</div>
          <div className="text-right">Cost</div>
          <div className="text-right">Margin</div>
          <div className="text-right">Margin%</div>
          <div className="text-right">Sold</div>
          <div className="text-right">Contribution</div>
        </div>
        {rows.map((r) => {
          const cs = CLASS_STYLE[r.menuClass];
          return (
            <div key={r.id} className="grid sm:grid-cols-[1.5fr_80px_80px_90px_70px_70px_110px] grid-cols-2 gap-3 px-4 py-3 items-center" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.name}</div>
                <span className="inline-block mt-0.5 text-[10.5px] px-1.5 py-0.5 rounded font-medium" style={{ background: cs.bg, color: cs.fg }}>{MENU_CLASS_LABEL[r.menuClass]}</span>
              </div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>{formatCents(r.priceCents)}</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>{formatCents(r.costCents)}</div>
              <div className="text-[12.5px] text-right font-medium" style={{ color: r.losing ? "var(--clay)" : "var(--ink)" }}>{formatCents(r.marginCents)}</div>
              <div className="text-[12.5px] text-right" style={{ color: r.losing ? "var(--clay)" : "var(--ink-soft)" }}>{bpsToPercent(r.marginBps).toFixed(1)}%</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>{r.units}</div>
              <div className="disp text-[14px] font-medium text-right" style={{ color: "var(--ink)" }}>{formatCents(r.contributionCents)}</div>
            </div>
          );
        })}
      </div>

      {/* Menu engineering legend */}
      <Card>
        <CardTitle title="Menu engineering" note="Profitability × popularity" />
        <div className="grid sm:grid-cols-2 gap-3">
          {(Object.keys(CLASS_STYLE) as MenuClass[]).map((k) => {
            const count = rows.filter((r) => r.menuClass === k).length;
            const cs = CLASS_STYLE[k];
            return (
              <div key={k} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                <span className="text-[11px] px-2 py-0.5 rounded font-medium shrink-0" style={{ background: cs.bg, color: cs.fg }}>{MENU_CLASS_LABEL[k]}</span>
                <span className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>{cs.blurb}</span>
                <span className="ml-auto text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{count}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}

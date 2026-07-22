import { TrendingUp, DollarSign, AlertTriangle, ChefHat, ArrowUpRight } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents, bpsToPercent } from "@/lib/money";
import { costPerUnitFromReceipt } from "@/lib/inventory";
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

export default async function ProfitabilityPage() {
  const { business } = await requireOwner();

  const meals = await db.meal.findMany({
    where: { businessId: business.id, active: true },
    select: {
      id: true,
      name: true,
      priceCents: true,
      ingredients: { select: { qty: true, trimBps: true, ingredient: { select: { costPerUnitCents: true } } } },
    },
  });

  const unitsAgg = await db.orderItem.groupBy({
    by: ["mealId"],
    where: { order: { businessId: business.id }, mealId: { not: null } },
    _sum: { qty: true },
  });
  const unitsByMeal = new Map(unitsAgg.map((u) => [u.mealId, u._sum.qty ?? 0]));

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
      <Head kicker="Profit" title="Menu profitability" sub="What each plate really costs, what it earns, and which meals to promote or fix." />

      <div className="grid sm:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<TrendingUp size={16} />} label="Avg margin" value={`${bpsToPercent(avgMarginBps).toFixed(1)}%`} />
        <Kpi icon={<DollarSign size={16} />} label="Avg food cost" value={`${bpsToPercent(avgFoodCostBps).toFixed(1)}%`} />
        <Kpi icon={<ChefHat size={16} />} label="Profit contribution" value={formatCents(totalContribution)} />
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

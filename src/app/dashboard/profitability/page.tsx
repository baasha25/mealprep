import { TrendingUp, DollarSign, AlertTriangle, ChefHat, ArrowUpRight, Trash2, Scale, Calculator } from "lucide-react";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle, Row, Hint } from "@/components/ui";
import { formatCents, bpsToPercent } from "@/lib/money";
import {
  rangeDays,
  proratePeriodCents,
  sumMonthlyByCategory,
  primeCostHealth,
} from "@/lib/operating-costs";
import { costPerUnitFromReceipt } from "@/lib/inventory";
import { revenueStatusWhere } from "@/lib/order-status";
import { RangeFilter } from "@/components/range-filter";
import { toRangeKey, rangeWhere, rangeLabel } from "@/lib/date-range";
import { summarizeLosses, LOSS_REASON_META, type LossReason } from "@/lib/loss";
import {
  plateCostFromRecipe,
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

// Prime Cost health pill + headline color, keyed to the ≤55% benchmark.
const TONE: Record<"good" | "warn" | "bad", { fg: string; bg: string; ink: string }> = {
  good: { fg: "#2f5e3f", bg: "#d9ead9", ink: "var(--pine)" },
  warn: { fg: "#8a6d1f", bg: "#f3e9c9", ink: "#8a6d1f" },
  bad: { fg: "#8a3f2f", bg: "#f3d9d0", ink: "var(--clay)" },
};

// Cost-stack segment colors, shared by the Prime Cost bar and per-plate bars.
const SEG = { food: "var(--clay)", labour: "#c9a227", overhead: "#9a9488", profit: "var(--pine)" } as const;

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
      expectedServings: true,
      actualServings: true,
      ingredients: { select: { qty: true, unit: true, trimBps: true, ingredient: { select: { unit: true, costPerUnitCents: true, densityGPerMl: true } } } },
    },
  });

  // Recipe-yield gaps (food-cost lever #3): recipe is costed for N servings but the
  // kitchen actually gets fewer, so the real per-plate cost is higher than shown.
  const yieldAlerts = meals
    .map((m) => {
      const e = m.expectedServings ?? 0;
      const a = m.actualServings ?? 0;
      if (!(e > 0) || !(a > 0) || a >= e) return null;
      return { name: m.name, overrunBps: Math.round((e / a - 1) * 10000) };
    })
    .filter(Boolean)
    .sort((x, y) => y!.overrunBps - x!.overrunBps) as { name: string; overrunBps: number }[];

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
    const cost = plateCostFromRecipe(m.ingredients);
    const econ = mealEconomics(m.priceCents, cost);
    const units = unitsByMeal.get(m.id) ?? 0;
    // A meal with no recipe has no known cost — showing "$0 cost / 100% margin"
    // would be a lie. Flag it, keep it out of the cost-based math, and render "—".
    const hasRecipe = m.ingredients.length > 0;
    return { id: m.id, name: m.name, priceCents: m.priceCents, costCents: cost, ...econ, units, contributionCents: econ.marginCents * units, hasRecipe };
  });
  // Only costed meals feed the margin/menu-engineering math and the P&L; uncosted
  // meals are listed separately so their unknown cost never inflates the numbers.
  const uncosted = base.filter((b) => !b.hasRecipe).sort((a, b) => a.name.localeCompare(b.name));
  const rows = classifyMenu(base.filter((b) => b.hasRecipe)).sort((a, b) => b.contributionCents - a.contributionCents);
  const uncostedSoldUnits = uncosted.reduce((s, r) => s + r.units, 0);

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

  // ---- Labour + overhead → Prime Cost and true operating profit ----
  const operatingCosts = await db.operatingCost.findMany({
    where: { businessId: business.id, active: true },
    select: { category: true, monthlyCents: true },
  });
  const { laborMonthly, overheadMonthly } = sumMonthlyByCategory(operatingCosts);
  const hasOpCosts = laborMonthly > 0 || overheadMonthly > 0;
  // Monthly labour/overhead prorated to the selected period so they line up with
  // the period's food revenue (Today / This Week / This Month / All time).
  const periodDays = rangeDays(range, new Date(), business.createdAt);
  const laborCents = proratePeriodCents(laborMonthly, periodDays);
  const overheadCents = proratePeriodCents(overheadMonthly, periodDays);

  // Prime Cost = food + labour; the industry health line is ≤ 55% of sales.
  const hasSales = foodRevenueCents > 0;
  const primeCents = foodCostCents + laborCents;
  const primeBps = hasSales ? Math.round((primeCents / foodRevenueCents) * 10000) : 0;
  const foodCostShareBps = hasSales ? Math.round((foodCostCents / foodRevenueCents) * 10000) : 0;
  const laborShareBps = hasSales ? Math.round((laborCents / foodRevenueCents) * 10000) : 0;
  const overheadShareBps = hasSales ? Math.round((overheadCents / foodRevenueCents) * 10000) : 0;
  const primeHealth = primeCostHealth(primeBps);

  // True operating profit = sales − food − labour − overhead − recorded loss.
  const trueProfitCents = grossMarginCents - lossCents - laborCents - overheadCents;
  const trueProfitBps = hasSales ? Math.round((trueProfitCents / foodRevenueCents) * 10000) : 0;

  // The menu table's contribution column is menu-margin (pre-loss).
  const totalContribution = rows.reduce((s, r) => s + r.contributionCents, 0);

  // Costed meals (with a menu-engineering class) first, then any uncosted meals.
  const displayRows = [
    ...rows.map((r) => ({ ...r, costed: true as const })),
    ...uncosted.map((r) => ({ ...r, costed: false as const })),
  ];

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

      {/* Prime Cost hero — food + labour vs the 55% health line */}
      {hasOpCosts ? (
        <Card className="mb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Scale size={15} style={{ color: "var(--pine)" }} />
                <span className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Prime Cost</span>
                <Hint text="Food cost + labour as a share of sales — the single most-watched number in a food business. At or under 55% is healthy; above it, profit is very hard. Bring it down by lowering food cost or labour." />
                {hasSales && (
                  <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: TONE[primeHealth.tone].bg, color: TONE[primeHealth.tone].fg }}>
                    {primeHealth.label}
                  </span>
                )}
              </div>
              {hasSales ? (
                <>
                  <div className="disp text-[34px] font-medium leading-none" style={{ color: TONE[primeHealth.tone].ink }}>
                    {bpsToPercent(primeBps).toFixed(1)}%
                  </div>
                  <div className="text-[12px] mt-2" style={{ color: "var(--muted)" }}>
                    Food {bpsToPercent(foodCostShareBps).toFixed(0)}% + Labour {bpsToPercent(laborShareBps).toFixed(0)}% · target under 55%
                  </div>
                </>
              ) : (
                <div className="text-[13px]" style={{ color: "var(--muted)" }}>No sales in this period yet — Prime Cost needs revenue to measure against.</div>
              )}
            </div>
            {hasSales && (
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Prime cost ({rangeLabel(range).toLowerCase()})</div>
                <div className="disp text-[20px] font-medium mt-1" style={{ color: "var(--ink)" }}>{formatCents(primeCents)}</div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>of {formatCents(foodRevenueCents)} sales</div>
              </div>
            )}
          </div>
          {hasSales && (
            <div className="mt-4">
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "var(--sand)" }}>
                <div className="absolute inset-y-0 left-0 flex">
                  <div style={{ width: `${Math.min(100, bpsToPercent(foodCostShareBps))}%`, background: SEG.food }} />
                  <div style={{ width: `${Math.min(100, bpsToPercent(laborShareBps))}%`, background: SEG.labour }} />
                </div>
                {/* 55% health line */}
                <div className="absolute inset-y-0" style={{ left: "55%", width: 2, background: "var(--ink)" }} title="55% target" />
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEG.food }} /> Food</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEG.labour }} /> Labour</span>
                <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: "var(--ink)" }} /> 55% target</span>
                <Link href="/dashboard/costs" className="ml-auto inline-flex items-center gap-1" style={{ color: "var(--pine)" }}>
                  <Calculator size={12} /> Edit labour & overhead
                </Link>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Link href="/dashboard/costs" className="block mb-5">
          <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl border" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
            <Scale size={17} style={{ color: "var(--pine)", marginTop: 1 }} />
            <div className="text-[13px]" style={{ color: "var(--ink)" }}>
              <strong>Unlock Prime Cost &amp; true profit.</strong>{" "}
              <span style={{ color: "var(--ink-soft)" }}>
                PrepFlow knows your food cost — add your <strong>labour</strong> and <strong>overhead</strong> to see Prime Cost % (food + labour, the ≤55% health line) and what each plate <em>really</em> nets after everything.
              </span>{" "}
              <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--pine)" }}>Add operating costs <Calculator size={12} /></span>
            </div>
          </div>
        </Link>
      )}

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
              <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>Net contribution</span>
              <span className="text-[13.5px] font-semibold" style={{ color: netContributionCents >= 0 ? "var(--ink)" : "var(--clay)" }}>
                {formatCents(netContributionCents)}
              </span>
            </div>
            {hasOpCosts ? (
              <>
                <Row l="Labour" v={`−${formatCents(laborCents)}`} />
                <Row l="Overhead" v={`−${formatCents(overheadCents)}`} />
                <div className="flex justify-between items-baseline pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
                  <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>True operating profit</span>
                  <span className="disp text-[18px] font-medium" style={{ color: trueProfitCents >= 0 ? "var(--pine)" : "var(--clay)" }}>
                    {formatCents(trueProfitCents)}
                    {hasSales && (
                      <span className="text-[12px] font-normal ml-1.5" style={{ color: "var(--muted)" }}>{bpsToPercent(trueProfitBps).toFixed(1)}%</span>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <Link href="/dashboard/costs" className="inline-flex items-center gap-1.5 text-[12px] pt-1.5" style={{ color: "var(--pine)" }}>
                <Calculator size={13} /> Add labour &amp; overhead to see true profit →
              </Link>
            )}
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
          Revenue and cost cover meals sold in the period (canceled/refunded excluded). Food loss is what you logged in Waste &amp; Loss{lossCents > 0 ? ` — eating ${bpsToPercent(lossShareBps).toFixed(1)}% of your gross margin` : ""}. {hasOpCosts ? "True operating profit then subtracts your monthly labour and overhead (from Operating Costs, prorated to this period) — before platform fees and income tax." : "This is contribution before labour and overhead — add those in Operating Costs to see your true profit."}
        </p>
      </Card>

      <div className="grid sm:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<TrendingUp size={16} />} label="Avg margin" value={`${bpsToPercent(avgMarginBps).toFixed(1)}%`} />
        <Kpi icon={<DollarSign size={16} />} label="Avg food cost" value={`${bpsToPercent(avgFoodCostBps).toFixed(1)}%`} />
        <Kpi icon={<ChefHat size={16} />} label={<span className="inline-flex items-center gap-1">Menu contribution (pre-loss) <Hint text="Each meal's margin × how many sold, added up — BEFORE food losses. Your true bottom line is 'Net contribution' in the P&L above, which subtracts losses." /></span>} value={formatCents(totalContribution)} />
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

      {yieldAlerts.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg mb-5" style={{ background: "color-mix(in srgb, #c9a227 10%, transparent)", border: "1px solid color-mix(in srgb, #c9a227 30%, transparent)" }}>
          <AlertTriangle size={16} style={{ color: "#8a6d1f", marginTop: 1 }} />
          <div className="text-[13px]" style={{ color: "var(--ink)" }}>
            <strong>Recipe yield is running short.</strong>{" "}
            {yieldAlerts.map((y) => (
              <span key={y.name}>
                {y.name} <span style={{ color: "#8a6d1f" }}>+{bpsToPercent(y.overrunBps).toFixed(0)}% real cost</span>.{" "}
              </span>
            ))}
            You&apos;re getting fewer servings than the recipe is costed for, so the true plate cost is higher than shown. Re-cost the recipe or fix the yield (portioning, trim, over-production).
          </div>
        </div>
      )}

      {/* No-recipe warning: these meals can't be costed, so they're left out of the numbers above. */}
      {uncosted.length > 0 && (
        <div className="rounded-xl border px-4 py-3 mb-4 flex gap-2.5 items-start" style={{ borderColor: "var(--clay)", background: "#fbf1ec" }}>
          <AlertTriangle size={16} style={{ color: "var(--clay)", marginTop: 1 }} />
          <div className="text-[12.5px]" style={{ color: "var(--ink)" }}>
            <span className="font-semibold">{uncosted.length} meal{uncosted.length === 1 ? "" : "s"} {uncosted.length === 1 ? "has" : "have"} no recipe yet</span>, so PrepFlow can&apos;t calculate {uncosted.length === 1 ? "its" : "their"} cost. {uncosted.length === 1 ? "It is" : "They are"} shown as &ldquo;—&rdquo; below and left out of the margins and P&amp;L above{uncostedSoldUnits > 0 ? `, even though ${uncosted.length === 1 ? "it" : "they"} sold ${uncostedSoldUnits} unit${uncostedSoldUnits === 1 ? "" : "s"} this period` : ""}. Add each meal&apos;s ingredients (Menu → meal → Edit) to see real cost, margin, and profit.
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
        {displayRows.map((r) => {
          // Uncosted meal (no recipe): show "—" for every cost-based figure and an
          // "Add recipe" prompt instead of a menu-engineering badge — never a fake 100%.
          if (!r.costed) {
            return (
              <div key={r.id} className="grid sm:grid-cols-[1.5fr_80px_80px_90px_70px_70px_110px] grid-cols-2 gap-3 px-4 py-3 items-center" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.name}</div>
                  <Link href={`/dashboard/menu/${r.id}/edit`} className="inline-block mt-0.5 text-[10.5px] px-1.5 py-0.5 rounded font-medium" style={{ background: "var(--paper-2, #efe9dd)", color: "var(--clay)" }}>Add recipe to cost</Link>
                </div>
                <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>{formatCents(r.priceCents)}</div>
                <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>—</div>
                <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>—</div>
                <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>—</div>
                <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>{r.units}</div>
                <div className="disp text-[14px] text-right" style={{ color: "var(--muted)" }}>—</div>
              </div>
            );
          }
          const cs = CLASS_STYLE[r.menuClass];
          return (
            <div key={r.id} className="grid sm:grid-cols-[1.5fr_80px_80px_90px_70px_70px_110px] grid-cols-2 gap-3 px-4 py-3 items-center" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.name}</div>
                <span title={cs.blurb} className="inline-block mt-0.5 text-[10.5px] px-1.5 py-0.5 rounded font-medium cursor-help" style={{ background: cs.bg, color: cs.fg }}>{MENU_CLASS_LABEL[r.menuClass]}</span>
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

      {/* Per-plate loaded profit: price − food − labour share − overhead share */}
      {hasOpCosts && hasSales && rows.length > 0 && (
        <Card className="mb-4">
          <CardTitle
            icon={<Scale size={15} />}
            title="What each plate really nets"
            note={`After food, labour & overhead · ${rangeLabel(range).toLowerCase()}`}
          />
          <p className="text-[12px] mb-3 -mt-2" style={{ color: "var(--muted)" }}>
            Menu margin only subtracts food. This loads every plate with its share of labour ({bpsToPercent(laborShareBps).toFixed(0)}% of price)
            and overhead ({bpsToPercent(overheadShareBps).toFixed(0)}%) — the real profit once everything is paid.
          </p>
          <div className="hidden sm:grid grid-cols-[1.7fr_70px_70px_75px_80px_92px] gap-3 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <div>Meal</div>
            <div className="text-right">Price</div>
            <div className="text-right">Food</div>
            <div className="text-right">Labour</div>
            <div className="text-right">Overhead</div>
            <div className="text-right">Real profit</div>
          </div>
          <div>
            {rows.map((r) => {
              const price = r.priceCents;
              const laborShare = Math.round((price * laborShareBps) / 10000);
              const overheadShare = Math.round((price * overheadShareBps) / 10000);
              const realProfit = price - r.costCents - laborShare - overheadShare;
              const realBps = price > 0 ? Math.round((realProfit / price) * 10000) : 0;
              const seg = (c: number) => (price > 0 ? Math.max(0, Math.min(100, (c / price) * 100)) : 0);
              return (
                <div key={r.id} className="grid sm:grid-cols-[1.7fr_70px_70px_75px_80px_92px] grid-cols-2 gap-3 items-center px-1 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.name}</div>
                    <div className="flex h-2 rounded-full overflow-hidden mt-1.5" style={{ background: "var(--sand)" }} title={`Food ${formatCents(r.costCents)} · Labour ${formatCents(laborShare)} · Overhead ${formatCents(overheadShare)} · Profit ${formatCents(realProfit)}`}>
                      <div style={{ width: `${seg(r.costCents)}%`, background: SEG.food }} />
                      <div style={{ width: `${seg(laborShare)}%`, background: SEG.labour }} />
                      <div style={{ width: `${seg(overheadShare)}%`, background: SEG.overhead }} />
                      <div style={{ width: `${seg(Math.max(0, realProfit))}%`, background: SEG.profit }} />
                    </div>
                  </div>
                  <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>{formatCents(price)}</div>
                  <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>−{formatCents(r.costCents)}</div>
                  <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>−{formatCents(laborShare)}</div>
                  <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>−{formatCents(overheadShare)}</div>
                  <div className="text-right">
                    <div className="disp text-[14px] font-medium" style={{ color: realProfit >= 0 ? "var(--pine)" : "var(--clay)" }}>{formatCents(realProfit)}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>{bpsToPercent(realBps).toFixed(0)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px]" style={{ color: "var(--muted)" }}>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEG.food }} /> Food</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEG.labour }} /> Labour</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEG.overhead }} /> Overhead</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEG.profit }} /> Profit</span>
          </div>
        </Card>
      )}

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

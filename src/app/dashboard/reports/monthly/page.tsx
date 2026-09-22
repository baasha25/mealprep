import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles, Clock, TrendingUp, ChefHat, Users, Repeat, Trash2, Star } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle, Row } from "@/components/ui";
import { formatCents, bpsToPercent } from "@/lib/money";
import { revenueStatusWhere } from "@/lib/order-status";
import { PrintButton } from "@/components/print-button";
import { monthRange, estimateAdminMinutes } from "@/lib/insights";
import { menuMarginSnapshot } from "@/lib/alerts-data";

export const dynamic = "force-dynamic";

/**
 * Monthly value report — one honest page a kitchen can print or screenshot:
 * what the business did this month, what PrepFlow handled, and the food-cost /
 * waste picture. Every number is real; the admin-time line is an estimate
 * built from a number the kitchen sets itself.
 */
export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { business } = await requireOwner();
  const { month } = await searchParams;
  const m = monthRange(month);
  const inMonth = { gte: m.start, lt: m.end };

  const [orders, itemsAgg, newCustomers, activeSubs, newSubs, losses, reviews, settings, snapshot, soldItems] = await Promise.all([
    db.order.findMany({ where: { businessId: business.id, createdAt: inMonth, ...revenueStatusWhere }, select: { totalCents: true, type: true } }),
    db.orderItem.aggregate({ where: { order: { businessId: business.id, createdAt: inMonth, ...revenueStatusWhere } }, _sum: { qty: true } }),
    db.customer.count({ where: { businessId: business.id, createdAt: inMonth } }),
    db.subscription.count({ where: { businessId: business.id, status: "active" } }),
    db.subscription.count({ where: { businessId: business.id, createdAt: inMonth } }),
    db.lossEvent.aggregate({ where: { businessId: business.id, createdAt: inMonth }, _sum: { costCents: true }, _count: { _all: true } }),
    db.mealReview.count({ where: { businessId: business.id, status: "approved", createdAt: inMonth } }),
    db.businessSettings.findFirst({ where: { businessId: business.id }, select: { adminMinutesPerOrder: true } }),
    menuMarginSnapshot(business.id),
    db.orderItem.findMany({ where: { order: { businessId: business.id, createdAt: inMonth, ...revenueStatusWhere }, mealId: { not: null } }, select: { mealId: true, qty: true, unitPriceCentsSnapshot: true } }),
  ]);

  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const meals = itemsAgg._sum.qty ?? 0;
  const aov = orders.length ? Math.round(revenueCents / orders.length) : 0;
  const subOrders = orders.filter((o) => o.type === "subscription").length;

  // Food cost for what actually sold this month (plate cost × units, costed meals only).
  const costBy = new Map(snapshot.rows.filter((r) => r.hasRecipe).map((r) => [r.id, r.costCents]));
  let foodRevenue = 0, foodCost = 0, costedUnits = 0;
  for (const it of soldItems) {
    const c = costBy.get(it.mealId as string);
    if (c == null) continue;
    foodRevenue += it.qty * it.unitPriceCentsSnapshot;
    foodCost += it.qty * c;
    costedUnits += it.qty;
  }
  const foodCostBps = foodRevenue > 0 ? Math.round((foodCost / foodRevenue) * 10000) : 0;
  const grossMargin = foodRevenue - foodCost;
  const lossCents = losses._sum.costCents ?? 0;

  const minutesPerOrder = settings?.adminMinutesPerOrder ?? 4;
  const adminMinutes = estimateAdminMinutes({ orders: orders.length, meals, minutesPerOrder });
  const adminHours = Math.round((adminMinutes / 60) * 10) / 10;

  const nav = (ym: string | null, dir: "prev" | "next") =>
    ym ? (
      <Link href={`/dashboard/reports/monthly?month=${ym}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] border" style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}>
        {dir === "prev" ? <><ArrowLeft size={13} /> Previous</> : <>Next <ArrowRight size={13} /></>}
      </Link>
    ) : null;

  return (
    <Page>
      <Head
        kicker="Finance"
        title={`Monthly value report — ${m.label}`}
        sub={`What ${business.name} did this month, and what PrepFlow handled for you. Print it, screenshot it, share it.`}
        right={<div className="no-print flex items-center gap-2 flex-wrap">{nav(m.prevYm, "prev")}{nav(m.nextYm, "next")}<PrintButton /></div>}
      />

      <div className="grid sm:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<TrendingUp size={16} />} label="Revenue" value={formatCents(revenueCents)} />
        <Kpi icon={<ChefHat size={16} />} label="Meals delivered" value={meals} />
        <Kpi icon={<Users size={16} />} label="New customers" value={newCustomers} />
        <Kpi icon={<Repeat size={16} />} label="Active subscriptions" value={activeSubs} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle icon={<Sparkles size={15} />} title="Handled by PrepFlow" note={m.label} />
          <div className="space-y-1.5 text-[13px]">
            <Row l="Orders processed" v={String(orders.length)} />
            <Row l="…of which subscription renewals" v={String(subOrders)} />
            <Row l="Meals produced, labelled & packed" v={String(meals)} />
            <Row l="New subscriptions started" v={String(newSubs)} />
            <Row l="Reviews collected (verified orders)" v={String(reviews)} />
            <Row l="Average order value" v={formatCents(aov)} />
          </div>
          <div className="mt-4 rounded-lg p-3.5" style={{ background: "color-mix(in srgb, var(--pine) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--pine) 22%, transparent)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={15} style={{ color: "var(--pine)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Estimated admin time saved</span>
            </div>
            <div className="disp text-[28px] font-medium leading-none" style={{ color: "var(--pine)" }}>{adminHours} hrs</div>
            <p className="text-[11.5px] mt-2" style={{ color: "var(--muted)" }}>
              Estimate: {orders.length} orders × {minutesPerOrder} min (your number, set in Settings) + {meals} meals × 0.5 min for labels/packing paperwork. Change the minutes in Settings → Customer notifications if it doesn't match how you used to work.
            </p>
          </div>
        </Card>

        <Card>
          <CardTitle icon={<TrendingUp size={15} />} title="Food cost & waste" note={m.label} />
          {costedUnits === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>No costed meals sold this month yet — add recipes to your meals to see food cost here.</p>
          ) : (
            <div className="space-y-1.5 text-[13px]">
              <Row l="Food revenue (costed meals)" v={formatCents(foodRevenue)} />
              <Row l="Food cost (COGS)" v={`−${formatCents(foodCost)}`} />
              <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
                <span className="font-medium" style={{ color: "var(--ink)" }}>Gross margin</span>
                <span className="font-semibold" style={{ color: "var(--ink)" }}>{formatCents(grossMargin)} <span className="font-normal text-[12px]" style={{ color: "var(--muted)" }}>· food cost {bpsToPercent(foodCostBps).toFixed(1)}%</span></span>
              </div>
              <Row l={`Food loss logged (${losses._count._all} event${losses._count._all === 1 ? "" : "s"})`} v={`−${formatCents(lossCents)}`} />
              <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
                <span className="font-medium" style={{ color: "var(--ink)" }}>Net contribution</span>
                <span className="font-semibold" style={{ color: grossMargin - lossCents >= 0 ? "var(--pine)" : "var(--clay)" }}>{formatCents(grossMargin - lossCents)}</span>
              </div>
            </div>
          )}
          <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>
            Plate costs use each meal's recipe (trim-aware, default options). Loss is what you logged in Waste &amp; Loss. Canceled/refunded orders are excluded everywhere on this page.
          </p>
          <div className="flex gap-3 mt-3 no-print">
            <Link href="/dashboard/profitability" className="text-[12px] inline-flex items-center gap-1" style={{ color: "var(--pine)" }}><TrendingUp size={12} /> Profitability</Link>
            <Link href="/dashboard/waste" className="text-[12px] inline-flex items-center gap-1" style={{ color: "var(--pine)" }}><Trash2 size={12} /> Waste log</Link>
            <Link href="/dashboard/reviews" className="text-[12px] inline-flex items-center gap-1" style={{ color: "var(--pine)" }}><Star size={12} /> Reviews</Link>
          </div>
        </Card>
      </div>
    </Page>
  );
}

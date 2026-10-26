import { db } from "@/lib/db";
import { revenueStatusWhere } from "@/lib/order-status";
import { experimentWindows, experimentVerdict, type Verdict } from "@/lib/price-test";

/** Units of one meal sold (earned revenue only) between two instants, by order date. */
export async function unitsSoldBetween(businessId: string, mealId: string, from: Date, to: Date): Promise<number> {
  const agg = await db.orderItem.aggregate({
    where: { mealId, order: { businessId, createdAt: { gte: from, lt: to }, ...revenueStatusWhere } },
    _sum: { qty: true },
  });
  return agg._sum.qty ?? 0;
}

export type ExperimentView = {
  id: string;
  mealId: string;
  mealName: string;
  basePriceCents: number;
  testPriceCents: number;
  costCents: number;
  startAt: Date;
  endAt: Date;
  status: string;
  baselineUnits: number;
  baselineDays: number;
  testUnits: number;
  testDays: number;
  verdict: Verdict;
};

/** All of a kitchen's price tests with live numbers (running ones measured up to now). */
export async function loadPriceExperiments(businessId: string, now: Date = new Date()): Promise<ExperimentView[]> {
  const rows = await db.priceExperiment.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 20, include: { meal: { select: { name: true } } } });
  const out: ExperimentView[] = [];
  for (const r of rows) {
    const w = experimentWindows(r.startAt, r.endAt, r.status === "running" ? now : (r.decidedAt ?? r.endAt));
    const testUnits = await unitsSoldBetween(businessId, r.mealId, w.test.from, w.test.to);
    const verdict = experimentVerdict({ baselineUnits: r.baselineUnits, baselineDays: r.baselineDays, testUnits, testDays: w.test.days, basePriceCents: r.basePriceCents, testPriceCents: r.testPriceCents, costCents: r.costCents });
    out.push({ id: r.id, mealId: r.mealId, mealName: r.meal.name, basePriceCents: r.basePriceCents, testPriceCents: r.testPriceCents, costCents: r.costCents, startAt: r.startAt, endAt: r.endAt, status: r.status, baselineUnits: r.baselineUnits, baselineDays: r.baselineDays, testUnits, testDays: w.test.days, verdict });
  }
  return out;
}

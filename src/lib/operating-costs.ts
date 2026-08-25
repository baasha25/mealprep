// Operating-cost model behind the Prime Cost metric and true-profit P&L.
//
// The restaurant-industry framing this implements:
//  - Prime Cost = Food Cost + Labour. Kept at/under 55% of sales = healthy;
//    above it, a food business struggles to profit.
//  - True profit = Sales − Food − Labour − Overhead (rent, utilities, insurance,
//    marketing, supplies). What's actually left after everything.
//
// Labour + overhead are entered as recurring MONTHLY figures. To line up with a
// range-filtered P&L (Today / This Week / This Month / All time), we prorate the
// monthly total to the number of days in the selected period.

import type { RangeKey } from "./date-range";

export type CostCategory = "labor" | "overhead";
export const COST_CATEGORIES: CostCategory[] = ["labor", "overhead"];

export const CATEGORY_META: Record<CostCategory, { label: string; blurb: string }> = {
  labor: {
    label: "Labour",
    blurb: "Wages, payroll taxes, and benefits for everyone who preps, cooks, and packs.",
  },
  overhead: {
    label: "Overhead",
    blurb: "Fixed monthly costs — rent, utilities, insurance, software, marketing, supplies.",
  },
};

export function toCostCategory(v: unknown): CostCategory {
  return v === "labor" ? "labor" : "overhead";
}

// Starter line items offered on the empty Operating Costs page — the categories
// from the classic overhead breakdown, so an owner isn't staring at a blank list.
export const OVERHEAD_TEMPLATE: { label: string; category: CostCategory }[] = [
  { label: "Kitchen wages", category: "labor" },
  { label: "Rent", category: "overhead" },
  { label: "Utilities", category: "overhead" },
  { label: "Insurance", category: "overhead" },
  { label: "Marketing", category: "overhead" },
  { label: "Packaging & supplies", category: "overhead" },
];

// Prime Cost health line (food + labour as a share of sales), in basis points.
export const PRIME_COST_TARGET_BPS = 5500; // 55%

const AVG_DAYS_PER_MONTH = 30.4375;

/** How many days the selected range covers (for prorating monthly costs). */
export function rangeDays(range: RangeKey, now: Date = new Date(), since?: Date | null): number {
  switch (range) {
    case "today":
      return 1;
    case "week":
      return 7;
    case "month":
      return Math.max(1, now.getDate()); // month-to-date, matching month-to-date revenue
    case "all":
    default: {
      if (!since) return AVG_DAYS_PER_MONTH;
      return Math.max(1, (now.getTime() - since.getTime()) / 86_400_000);
    }
  }
}

/** Monthly recurring cents → the share that falls inside a period of `days` days. */
export function proratePeriodCents(monthlyCents: number, days: number): number {
  return Math.round(monthlyCents * (days / AVG_DAYS_PER_MONTH));
}

export type OperatingCostRow = { category: string; monthlyCents: number };

/** Sum monthly cost by category. */
export function sumMonthlyByCategory(costs: OperatingCostRow[]): {
  laborMonthly: number;
  overheadMonthly: number;
} {
  let laborMonthly = 0;
  let overheadMonthly = 0;
  for (const c of costs) {
    if (c.category === "labor") laborMonthly += c.monthlyCents;
    else overheadMonthly += c.monthlyCents;
  }
  return { laborMonthly, overheadMonthly };
}

export type PrimeCostHealth = { label: string; tone: "good" | "warn" | "bad" };

/** Plain-English verdict on a Prime Cost %, in basis points. */
export function primeCostHealth(primeBps: number): PrimeCostHealth {
  if (primeBps <= PRIME_COST_TARGET_BPS) return { label: "Healthy", tone: "good" };
  if (primeBps <= PRIME_COST_TARGET_BPS + 500) return { label: "Tight", tone: "warn" }; // ≤60%
  return { label: "Too high", tone: "bad" };
}

import Link from "next/link";
import { Wallet, TrendingUp } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { revenueStatusWhere } from "@/lib/order-status";
import { rangeWhere } from "@/lib/date-range";
import { toCostCategory, type CostCategory } from "@/lib/operating-costs";
import { CostsManager, type CostRow } from "./costs-form";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const { business } = await requireOwner();

  const costs = await db.operatingCost.findMany({
    where: { businessId: business.id, active: true },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, category: true, monthlyCents: true },
  });

  // This-month menu sales, to show each cost as a % of sales (the doc's framing).
  const soldThisMonth = await db.orderItem.findMany({
    where: { order: { businessId: business.id, ...rangeWhere("month"), ...revenueStatusWhere }, mealId: { not: null } },
    select: { qty: true, unitPriceCentsSnapshot: true },
  });
  const monthlyRevenueCents = soldThisMonth.reduce((s, it) => s + it.qty * it.unitPriceCentsSnapshot, 0);

  const rows: CostRow[] = costs.map((c) => ({
    id: c.id,
    label: c.label,
    category: toCostCategory(c.category) as CostCategory,
    monthlyCents: c.monthlyCents,
  }));

  return (
    <Page>
      <Head
        kicker="Costs"
        title="Operating Costs"
        sub="Your monthly labour and overhead — the other half of what it costs to run the kitchen. Feeds Prime Cost and true profit on Profitability."
        right={
          <Link
            href="/dashboard/profitability"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: "var(--pine)" }}
          >
            <TrendingUp size={15} /> See Prime Cost & profit
          </Link>
        }
      />

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg mb-5" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
        <Wallet size={16} style={{ color: "var(--pine)", marginTop: 1 }} />
        <p className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
          PrepFlow already knows your <strong>food cost</strong> from recipes. Add <strong>labour</strong> (wages, payroll taxes,
          benefits) and <strong>overhead</strong> (rent, utilities, insurance, marketing, supplies) here, and Profitability will show
          your <strong>Prime Cost %</strong> (food + labour — keep it under 55%) and your <strong>true profit</strong> after everything.
        </p>
      </div>

      <CostsManager rows={rows} monthlyRevenueCents={monthlyRevenueCents} />
    </Page>
  );
}

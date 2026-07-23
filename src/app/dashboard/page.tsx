import Link from "next/link";
import { TrendingUp, ChefHat, Repeat, Receipt, Gauge, ArrowUpCircle } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents, formatCents0 } from "@/lib/money";
import { orderLimitStatus } from "@/lib/usage";
import { TIERS, type TierKey } from "@/lib/tiers";
import { RangeFilter } from "@/components/range-filter";
import { toRangeKey, rangeWhere, rangeLabel } from "@/lib/date-range";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business, role } = await requireBusiness();
  const range = toRangeKey((await searchParams).range);

  // Personalized, role-aware greeting so it's clear who's signed in.
  let displayName = "Chef";
  if (process.env.CLERK_SECRET_KEY) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const cu = await currentUser();
    displayName =
      cu?.firstName || cu?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Chef";
  }
  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  // Orders in the selected period (active subs are point-in-time, not period-scoped).
  const where = { businessId: business.id, ...rangeWhere(range) };

  const usage = await orderLimitStatus({ id: business.id, tier: business.tier as TierKey });
  const planName = TIERS[usage.tier].name;
  const pct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  const [orders, subCount, agg] = await Promise.all([
    db.order.count({ where }),
    db.subscription.count({ where: { businessId: business.id, status: "active" } }),
    db.order.aggregate({
      where,
      _sum: { subtotalCents: true, totalCents: true },
    }),
  ]);

  const itemsAgg = await db.orderItem.aggregate({
    where: { order: where },
    _sum: { qty: true },
  });

  const revenueCents = agg._sum.totalCents ?? 0;
  const mealsOrdered = itemsAgg._sum.qty ?? 0;
  const aovCents = orders > 0 ? Math.round(revenueCents / orders) : 0;

  return (
    <Page>
      <Head
        kicker="Overview"
        title={`${greeting}, ${displayName}`}
        sub={`How ${business.name} is performing — ${rangeLabel(range).toLowerCase()}.`}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-1 rounded-md text-[10.5px] font-semibold uppercase tracking-wide"
              style={{
                background: role === "owner" ? "var(--pine)" : "var(--sand)",
                color: role === "owner" ? "#f4f2ec" : "var(--muted)",
              }}
            >
              {role === "owner" ? "Owner" : "Staff"}
            </span>
            <RangeFilter basePath="/dashboard" current={range} />
          </div>
        }
      />
      <div className="grid sm:grid-cols-4 gap-3.5 mb-4">
        <Kpi
          icon={<TrendingUp size={16} />}
          label="Revenue (period)"
          value={formatCents0(revenueCents)}
        />
        <Kpi
          icon={<ChefHat size={16} />}
          label="Meals ordered"
          value={mealsOrdered}
        />
        <Kpi
          icon={<Repeat size={16} />}
          label="Active subscriptions"
          value={subCount}
        />
        <Kpi
          icon={<Receipt size={16} />}
          label="Avg order value"
          value={formatCents(aovCents)}
        />
      </div>
      <Card>
        <CardTitle icon={<Gauge size={15} />} title="Plan usage" note={`${planName} plan`} />
        {usage.limit === null ? (
          <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            <strong>{usage.used}</strong> orders this month · unlimited on your {planName} plan.
          </p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13.5px]" style={{ color: "var(--ink)" }}>
                <strong>{usage.used}</strong> of {usage.limit} orders this month
              </span>
              <span className="text-[12.5px]" style={{ color: usage.atLimit ? "var(--clay)" : "var(--muted)" }}>
                {usage.remaining} left
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--sand)" }}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${pct}%`, background: usage.atLimit ? "var(--clay)" : "var(--pine)" }}
              />
            </div>
            {(usage.nearLimit || usage.atLimit) && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                  {usage.atLimit ? "You've hit your monthly limit." : "You're close to your monthly limit."}
                </span>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium"
                  style={{ background: "var(--pine)", color: "#f4f2ec" }}
                >
                  <ArrowUpCircle size={14} /> Upgrade plan
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>
    </Page>
  );
}

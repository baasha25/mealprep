import Link from "next/link";
import { TrendingUp, ChefHat, Repeat, Receipt, Gauge, ArrowUpCircle, Monitor, Tag, Wallet } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents, formatCents0 } from "@/lib/money";
import { orderLimitStatus } from "@/lib/usage";
import { TIERS, type TierKey } from "@/lib/tiers";
import { RangeFilter } from "@/components/range-filter";
import { toRangeKey, rangeWhere, rangeLabel } from "@/lib/date-range";

const STAFF_LINKS: [string, string, typeof ChefHat][] = [
  ["/dashboard/kitchen", "Kitchen OS", ChefHat],
  ["/dashboard/kds", "Kitchen Display", Monitor],
  ["/dashboard/orders", "Orders", Receipt],
  ["/dashboard/fulfillment", "Labels & packing", Tag],
  ["/dashboard/pos", "POS Terminal", Wallet],
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business, role } = await requireBusiness();
  const isOwner = role === "owner";
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

  // Financials are OWNER-ONLY. Staff never see revenue, KPIs, or plan/billing —
  // so we don't even run the money queries for them.
  let fin: {
    revenueCents: number;
    mealsOrdered: number;
    subCount: number;
    aovCents: number;
    usage: Awaited<ReturnType<typeof orderLimitStatus>>;
    planName: string;
    pct: number;
  } | null = null;

  if (isOwner) {
    const where = { businessId: business.id, ...rangeWhere(range) };
    const usage = await orderLimitStatus({ id: business.id, tier: business.tier as TierKey });
    const [orders, subCount, agg] = await Promise.all([
      db.order.count({ where }),
      db.subscription.count({ where: { businessId: business.id, status: "active" } }),
      db.order.aggregate({ where, _sum: { subtotalCents: true, totalCents: true } }),
    ]);
    const itemsAgg = await db.orderItem.aggregate({ where: { order: where }, _sum: { qty: true } });
    const revenueCents = agg._sum.totalCents ?? 0;
    fin = {
      revenueCents,
      mealsOrdered: itemsAgg._sum.qty ?? 0,
      subCount,
      aovCents: orders > 0 ? Math.round(revenueCents / orders) : 0,
      usage,
      planName: TIERS[usage.tier].name,
      pct: usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0,
    };
  }

  return (
    <Page>
      <Head
        kicker="Overview"
        title={`${greeting}, ${displayName}`}
        sub={
          isOwner
            ? `How ${business.name} is performing — ${rangeLabel(range).toLowerCase()}.`
            : `You're set up for the kitchen at ${business.name}.`
        }
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-1 rounded-md text-[10.5px] font-semibold uppercase tracking-wide"
              style={{
                background: isOwner ? "var(--pine)" : "var(--sand)",
                color: isOwner ? "#f4f2ec" : "var(--muted)",
              }}
            >
              {isOwner ? "Owner" : "Staff"}
            </span>
            {isOwner && <RangeFilter basePath="/dashboard" current={range} />}
          </div>
        }
      />

      {fin ? (
        <>
          <div className="grid sm:grid-cols-4 gap-3.5 mb-4">
            <Kpi icon={<TrendingUp size={16} />} label="Revenue (period)" value={formatCents0(fin.revenueCents)} />
            <Kpi icon={<ChefHat size={16} />} label="Meals ordered" value={fin.mealsOrdered} />
            <Kpi icon={<Repeat size={16} />} label="Active subscriptions" value={fin.subCount} />
            <Kpi icon={<Receipt size={16} />} label="Avg order value" value={formatCents(fin.aovCents)} />
          </div>
          <Card>
            <CardTitle icon={<Gauge size={15} />} title="Plan usage" note={`${fin.planName} plan`} />
            {fin.usage.limit === null ? (
              <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
                <strong>{fin.usage.used}</strong> orders this month · unlimited on your {fin.planName} plan.
              </p>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13.5px]" style={{ color: "var(--ink)" }}>
                    <strong>{fin.usage.used}</strong> of {fin.usage.limit} orders this month
                  </span>
                  <span className="text-[12.5px]" style={{ color: fin.usage.atLimit ? "var(--clay)" : "var(--muted)" }}>
                    {fin.usage.remaining} left
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--sand)" }}>
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${fin.pct}%`, background: fin.usage.atLimit ? "var(--clay)" : "var(--pine)" }}
                  />
                </div>
                {(fin.usage.nearLimit || fin.usage.atLimit) && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                      {fin.usage.atLimit ? "You've hit your monthly limit." : "You're close to your monthly limit."}
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
        </>
      ) : (
        /* Staff: no financials — just jump-into-work links. */
        <Card>
          <CardTitle icon={<ChefHat size={15} />} title="Today in the kitchen" />
          <p className="text-[13.5px] mb-4" style={{ color: "var(--ink-soft)" }}>
            You have kitchen and fulfillment access. Jump into your work:
          </p>
          <div className="flex flex-wrap gap-2.5">
            {STAFF_LINKS.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[13px] font-medium border"
                style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--paper)" }}
              >
                <Icon size={15} style={{ color: "var(--pine)" }} /> {label}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </Page>
  );
}

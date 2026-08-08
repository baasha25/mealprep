import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, Receipt, Repeat, Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { Kpi } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { TIERS, type TierKey } from "@/lib/tiers";
import { monthStart } from "@/lib/usage";
import { revenueStatusWhere } from "@/lib/order-status";
import { sourceLabel } from "@/lib/attribution";
import { TierSelect } from "../tier-select";
import { CompToggle } from "../comp-toggle";

export const dynamic = "force-dynamic";

export default async function AdminKitchenPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requireSuperAdmin();
  const { businessId } = await params;

  const biz = await db.business.findUnique({
    where: { id: businessId },
    include: { users: { select: { email: true, role: true } }, _count: { select: { customers: true } } },
  });
  if (!biz) notFound();

  const start = monthStart();
  const [revAgg, ordersMonth, activeSubs, recentOrders, topSpend] = await Promise.all([
    db.order.aggregate({ where: { businessId, ...revenueStatusWhere }, _sum: { totalCents: true } }),
    db.order.count({ where: { businessId, ...revenueStatusWhere, createdAt: { gte: start } } }),
    db.subscription.count({ where: { businessId, status: "active" } }),
    db.order.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, type: true, status: true, totalCents: true, createdAt: true, customer: { select: { name: true } } },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { businessId, ...revenueStatusWhere, customerId: { not: null } },
      _sum: { totalCents: true },
      orderBy: { _sum: { totalCents: "desc" } },
      take: 5,
    }),
  ]);

  const topCustomers = await Promise.all(
    topSpend.map(async (t) => {
      const c = await db.customer.findUnique({ where: { id: t.customerId! }, select: { name: true, email: true } });
      return { name: c?.name ?? "—", email: c?.email ?? "", spend: t._sum.totalCents ?? 0 };
    }),
  );

  // Revenue by month (last 6 months) from earned orders.
  const sixAgo = new Date(start);
  sixAgo.setMonth(sixAgo.getMonth() - 5);
  const monthOrders = await db.order.findMany({
    where: { businessId, ...revenueStatusWhere, createdAt: { gte: sixAgo } },
    select: { totalCents: true, createdAt: true },
  });
  const monthMap = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() - (5 - i));
    monthMap.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
  }
  for (const o of monthOrders) {
    const k = `${o.createdAt.getFullYear()}-${o.createdAt.getMonth()}`;
    if (monthMap.has(k)) monthMap.set(k, (monthMap.get(k) ?? 0) + o.totalCents);
  }
  const months = [...monthMap.entries()].map(([k, v]) => {
    const [y, m] = k.split("-").map(Number);
    return { label: new Date(y, m, 1).toLocaleString("en-US", { month: "short" }), cents: v };
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.cents));

  const tier = biz.tier as TierKey;
  const owner = biz.users.find((u) => u.role === "owner")?.email ?? biz.users[0]?.email ?? "—";
  const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
  const statusColor: Record<string, string> = { paid: "var(--pine)", fulfilled: "var(--pine)", canceled: "var(--muted)", refunded: "var(--clay)" };

  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12.5px] mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> All kitchens
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="disp text-[26px] leading-none font-medium" style={{ color: "var(--ink)" }}>{biz.name}</h1>
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--muted)" }}>
            /{biz.slug ?? "—"} · {owner} · joined {fmtDate.format(biz.createdAt)} · via {sourceLabel(biz.acqSource)}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <TierSelect businessId={biz.id} tier={tier} />
          <CompToggle businessId={biz.id} comped={biz.billingComped} />
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3.5 mb-6">
        <Kpi icon={<DollarSign size={16} />} label="Revenue (all-time)" value={formatCents(revAgg._sum.totalCents ?? 0)} />
        <Kpi icon={<Receipt size={16} />} label="Orders this month" value={ordersMonth} />
        <Kpi icon={<Repeat size={16} />} label="Active subscriptions" value={activeSubs} />
        <Kpi icon={<Users size={16} />} label="Customers" value={biz._count.customers} />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Recent orders */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>Recent orders</div>
          {recentOrders.length === 0 ? (
            <p className="px-4 py-6 text-[13px]" style={{ color: "var(--muted)" }}>No orders yet.</p>
          ) : (
            recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="min-w-0">
                  <div className="text-[13px] truncate" style={{ color: "var(--ink)" }}>{o.customer?.name ?? "Guest"}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>#{o.id.slice(-6)} · {o.type} · {fmtDate.format(o.createdAt)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{formatCents(o.totalCents)}</div>
                  <div className="text-[10.5px]" style={{ color: statusColor[o.status] ?? "var(--muted)" }}>{o.status}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          {/* Revenue by month */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Revenue · last 6 months</div>
            <div className="flex items-end gap-2 h-24">
              {months.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t" style={{ height: `${Math.max(2, (m.cents / maxMonth) * 80)}px`, background: "var(--pine)" }} title={formatCents(m.cents)} />
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top customers */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--muted)" }}>Top customers</div>
            {topCustomers.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>None yet.</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-[12.5px]">
                    <span className="truncate" style={{ color: "var(--ink)" }}>{c.name}</span>
                    <span className="font-medium shrink-0" style={{ color: "var(--ink-soft)" }}>{formatCents(c.spend)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11.5px] mt-4" style={{ color: "var(--muted)" }}>
        Plan is {TIERS[tier].name} (${Math.round(TIERS[tier].priceCents / 100)}/mo). Comping gives free access — no charge, never locks — for founding customers or your demo.
      </p>
    </>
  );
}

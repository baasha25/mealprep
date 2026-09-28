import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, Receipt, Repeat, Users, CreditCard, ExternalLink, CheckCircle2, Circle, Activity, Percent } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { Kpi } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { TIERS, type TierKey } from "@/lib/tiers";
import { monthStart } from "@/lib/usage";
import { revenueStatusWhere } from "@/lib/order-status";
import { sourceLabel } from "@/lib/attribution";
import { trialStatus } from "@/lib/trial";
import { billingBadge, setupScore, momentum, platformFeeCents, agoLabel, dailyBuckets } from "@/lib/admin-metrics";
import { TierSelect } from "../tier-select";
import { CompToggle } from "../comp-toggle";
import { Badge } from "../badge";

export const dynamic = "force-dynamic";

const STRIPE = "https://dashboard.stripe.com";

// Per-kitchen drill-down for the operator. Server-rendered behind
// requireSuperAdmin() only — no client data fetching.
export default async function AdminKitchenPage({ params }: { params: Promise<{ businessId: string }> }) {
  await requireSuperAdmin();
  const { businessId } = await params;

  const biz = await db.business.findUnique({
    where: { id: businessId },
    include: {
      users: { select: { email: true, role: true, name: true } },
      settings: { select: { platformFeeBps: true } },
      referredByPartner: { select: { name: true, code: true } },
      _count: { select: { customers: true, meals: true, plans: true, orders: true } },
    },
  });
  if (!biz) notFound();

  const now = new Date();
  const start = monthStart(now);
  const lastStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const d30 = new Date(now.getTime() - 30 * 86_400_000);

  const [revAgg, thisMo, lastMo, activeSubs, recentOrders, topSpend, last30Orders, newCustomers30, newSubs30, canceledSubs30, lastOrder] = await Promise.all([
    db.order.aggregate({ where: { businessId, ...revenueStatusWhere }, _sum: { totalCents: true } }),
    db.order.aggregate({ where: { businessId, ...revenueStatusWhere, createdAt: { gte: start } }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.order.aggregate({ where: { businessId, ...revenueStatusWhere, createdAt: { gte: lastStart, lt: start } }, _count: { _all: true }, _sum: { totalCents: true } }),
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
    db.order.findMany({ where: { businessId, ...revenueStatusWhere, createdAt: { gte: d30 } }, select: { createdAt: true } }),
    db.customer.count({ where: { businessId, createdAt: { gte: d30 } } }),
    db.subscription.count({ where: { businessId, createdAt: { gte: d30 } } }),
    db.subscription.count({ where: { businessId, status: "canceled", updatedAt: { gte: d30 } } }),
    db.order.findFirst({ where: { businessId, ...revenueStatusWhere }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
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
  const feeBps = biz.settings?.platformFeeBps ?? TIERS[tier].platformFeeBps;
  const badge = billingBadge({ ...biz, tier }, now);
  const trial = trialStatus(biz.trialEndsAt, now);
  const setup = setupScore({ meals: biz._count.meals, plans: biz._count.plans, stripeConnected: biz.stripeChargesEnabled, hasLogo: !!biz.logoUrl, orders: biz._count.orders, activeSubs });
  const mom = momentum(thisMo._count._all, lastMo._count._all);
  const gmvMo = thisMo._sum.totalCents ?? 0;
  const days = dailyBuckets(last30Orders.map((o) => o.createdAt), 30, now);
  const maxDay = Math.max(1, ...days.map((d) => d.n));

  const ownerUser = biz.users.find((u) => u.role === "owner") ?? biz.users[0];
  const owner = ownerUser?.email ?? "—";
  const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
  const statusColor: Record<string, string> = { paid: "var(--pine)", fulfilled: "var(--pine)", canceled: "var(--muted)", refunded: "var(--clay)" };
  const card = { borderColor: "var(--line)", background: "var(--surface)" } as const;
  const sectionTitle = "text-[11px] font-semibold uppercase tracking-wide";

  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12.5px] mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> All kitchens
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="disp text-[26px] leading-none font-medium" style={{ color: "var(--ink)" }}>{biz.name}</h1>
            <Badge tone={badge.tone} title={badge.detail}>{badge.label}</Badge>
            {!biz.stripeChargesEnabled && <Badge tone="clay">Stripe not connected</Badge>}
          </div>
          <p className="text-[12.5px] mt-1.5" style={{ color: "var(--muted)" }}>
            /{biz.slug ?? "—"} · {ownerUser?.name ? `${ownerUser.name} · ` : ""}{owner} · joined {fmtDate.format(biz.createdAt)} · via {sourceLabel(biz.acqSource)}
            {biz.referredByPartner && <> · partner <strong style={{ color: "var(--ink-soft)" }}>{biz.referredByPartner.name}</strong> ({biz.referredByPartner.code})</>}
            {biz.slug && <> · <a href={`/store/${biz.slug}`} target="_blank" rel="noreferrer" className="underline">open storefront</a></>}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <TierSelect businessId={biz.id} tier={tier} />
          <CompToggle businessId={biz.id} comped={biz.billingComped} />
        </div>
      </div>

      {biz.customDomain && (
        <div className="rounded-xl border px-4 py-3 mb-6 text-[12.5px] leading-relaxed" style={{ borderColor: "color-mix(in srgb, var(--pine) 30%, transparent)", background: "color-mix(in srgb, var(--pine) 6%, transparent)", color: "var(--ink)" }}>
          <strong>Custom domain requested:</strong> <code>{biz.customDomain}</code> → storefront <code>/store/{biz.slug}</code>. To activate: (1) Netlify → Domain management → add <code>{biz.customDomain}</code> as a domain alias (SSL provisions once their CNAME points at prepflow.ca); (2) add <code>{biz.customDomain}={biz.slug}</code> to the <code>CUSTOM_DOMAINS</code> env (comma-separated) and redeploy.
        </div>
      )}

      <div className="grid sm:grid-cols-5 gap-3.5 mb-6">
        <Kpi icon={<Receipt size={16} />} label={<>Orders this month · <span style={{ color: mom.dir === "down" ? "var(--clay)" : mom.dir === "up" ? "var(--pine)" : "var(--muted)" }}>{mom.label}</span> vs last</>} value={thisMo._count._all} />
        <Kpi icon={<DollarSign size={16} />} label="Sales this month" value={formatCents(gmvMo)} />
        <Kpi icon={<Percent size={16} />} label={`Our fee this month · ${feeBps / 100}%`} value={formatCents(platformFeeCents(gmvMo, feeBps))} />
        <Kpi icon={<Repeat size={16} />} label="Active subscriptions" value={activeSubs} />
        <Kpi icon={<Users size={16} />} label={<>Customers · last order {agoLabel(lastOrder?.createdAt ?? null, now)}</>} value={biz._count.customers} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Billing */}
        <div className="rounded-xl border p-4" style={card}>
          <div className={`${sectionTitle} mb-3 flex items-center gap-1.5`} style={{ color: "var(--muted)" }}><CreditCard size={13} /> Software billing</div>
          <dl className="text-[12.5px] space-y-1.5">
            <Row l="Status" v={<Badge tone={badge.tone}>{badge.label}</Badge>} />
            <Row l="Plan" v={`${TIERS[tier].name} · $${TIERS[tier].priceCents / 100}/mo · ${TIERS[tier].platformFeeBps / 100}% fee`} />
            <Row l="Trial ends" v={trial.endsAt ? `${fmtDate.format(trial.endsAt)}${trial.active ? ` (${trial.daysLeft}d left)` : " (ended)"}` : "—"} />
            <Row l="Stripe status" v={biz.billingStatus} />
            <Row l="Comped" v={biz.billingComped ? "Yes — never charged" : "No"} />
          </dl>
          <p className="text-[11.5px] mt-2.5 leading-relaxed" style={{ color: "var(--muted)" }}>{badge.detail}</p>
          <div className="flex flex-col gap-1.5 mt-3 text-[12px]">
            {biz.billingCustomerId ? (
              <a className="inline-flex items-center gap-1 underline" style={{ color: "var(--pine)" }} href={`${STRIPE}/customers/${biz.billingCustomerId}`} target="_blank" rel="noreferrer">Stripe customer (software billing) <ExternalLink size={11} /></a>
            ) : (
              <span style={{ color: "var(--muted)" }}>No Stripe customer yet — they haven't started a paid plan.</span>
            )}
            {biz.billingSubscriptionId && (
              <a className="inline-flex items-center gap-1 underline" style={{ color: "var(--pine)" }} href={`${STRIPE}/subscriptions/${biz.billingSubscriptionId}`} target="_blank" rel="noreferrer">Stripe subscription <ExternalLink size={11} /></a>
            )}
            {biz.stripeAccountId ? (
              <a className="inline-flex items-center gap-1 underline" style={{ color: "var(--pine)" }} href={`${STRIPE}/connect/accounts/${biz.stripeAccountId}`} target="_blank" rel="noreferrer">Connected account (their payouts) <ExternalLink size={11} /></a>
            ) : (
              <span style={{ color: "var(--clay)" }}>No connected Stripe account — they can't take customer payments.</span>
            )}
          </div>
        </div>

        {/* Setup checklist */}
        <div className="rounded-xl border p-4" style={card}>
          <div className={`${sectionTitle} mb-3 flex items-center justify-between`} style={{ color: "var(--muted)" }}>
            <span>Setup · {setup.done} of {setup.total}</span>
            {setup.complete && <span style={{ color: "var(--pine)" }}>Fully live</span>}
          </div>
          <ul className="space-y-2">
            {setup.items.map((i) => (
              <li key={i.key} className="flex items-start gap-2 text-[12.5px]">
                {i.done ? <CheckCircle2 size={15} style={{ color: "var(--pine)", marginTop: 1 }} /> : <Circle size={15} style={{ color: "var(--clay)", marginTop: 1 }} />}
                <div>
                  <div style={{ color: i.done ? "var(--ink)" : "var(--ink)", fontWeight: i.done ? 400 : 600 }}>{i.label}</div>
                  {!i.done && <div className="text-[11px] leading-snug" style={{ color: "var(--muted)" }}>{i.nudge}</div>}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>{biz._count.meals} meals · {biz._count.plans} plans · {biz._count.orders} orders all-time</p>
        </div>

        {/* 30-day activity */}
        <div className="rounded-xl border p-4" style={card}>
          <div className={`${sectionTitle} mb-3 flex items-center gap-1.5`} style={{ color: "var(--muted)" }}><Activity size={13} /> Last 30 days</div>
          <div className="flex items-end gap-[2px] h-16" title="Orders per day">
            {days.map((d, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(2, (d.n / maxDay) * 60)}px`, background: d.n ? "var(--pine)" : "var(--sand)" }} title={`${d.day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${d.n} order${d.n === 1 ? "" : "s"}`} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--muted)" }}><span>30d ago</span><span>today</span></div>
          <dl className="text-[12.5px] space-y-1.5 mt-3">
            <Row l="Orders" v={`${last30Orders.length}`} />
            <Row l="New customers" v={`${newCustomers30}`} />
            <Row l="New subscriptions" v={`${newSubs30}`} />
            <Row l="Canceled subscriptions" v={<span style={{ color: canceledSubs30 ? "var(--clay)" : "var(--ink)" }}>{canceledSubs30}</span>} />
          </dl>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Recent orders */}
        <div className="rounded-xl border overflow-hidden" style={card}>
          <div className={`px-4 py-2.5 ${sectionTitle}`} style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>Recent orders</div>
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
          <div className="rounded-xl border p-4" style={card}>
            <div className={`${sectionTitle} mb-3`} style={{ color: "var(--muted)" }}>Sales · last 6 months · {formatCents(revAgg._sum.totalCents ?? 0)} all-time</div>
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
          <div className="rounded-xl border p-4" style={card}>
            <div className={`${sectionTitle} mb-2.5`} style={{ color: "var(--muted)" }}>Top customers</div>
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
        Sales exclude canceled and refunded orders. Comping gives free access — no charge, never locks — for founding customers or your own kitchen.
      </p>
    </>
  );
}

function Row({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt style={{ color: "var(--muted)" }}>{l}</dt>
      <dd className="text-right" style={{ color: "var(--ink)" }}>{v}</dd>
    </div>
  );
}

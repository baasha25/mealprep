import Link from "next/link";
import { Store, DollarSign, Compass, Percent, ShoppingBag, Clock, MoonStar, AlertTriangle, Sparkles, Search, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { Kpi } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { TIERS, type TierKey } from "@/lib/tiers";
import { monthStart } from "@/lib/usage";
import { revenueStatusWhere } from "@/lib/order-status";
import { sourceLabel } from "@/lib/attribution";
import { trialStatus } from "@/lib/trial";
import {
  billingBadge, setupScore, momentum, isQuiet, platformFeeCents, agoLabel,
  parseFilter, filterKitchens, KITCHEN_FILTERS, FILTER_LABEL, TRIAL_SOON_DAYS, QUIET_DAYS, type KitchenFilter,
} from "@/lib/admin-metrics";
import { TierSelect } from "./tier-select";
import { Badge } from "./badge";

export const dynamic = "force-dynamic";

// Operator overview. Every number here is rendered server-side behind
// requireSuperAdmin() (email allowlist → 404 for anyone else). There is no
// client-side data API for any of it.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const filter = parseFilter(sp.f);
  const q = (sp.q ?? "").slice(0, 80);

  const now = new Date();
  const start = monthStart(now);
  const lastStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);

  const [businesses, thisMo, lastMo, allTime, subGroup] = await Promise.all([
    db.business.findMany({
      where: { isDemo: false }, // throwaway demo tenants never appear in the operator panel
      orderBy: { createdAt: "desc" },
      include: {
        users: { select: { email: true, role: true } },
        settings: { select: { platformFeeBps: true } },
        referredByPartner: { select: { name: true, code: true } },
        _count: { select: { customers: true, orders: true, meals: true, plans: true } },
      },
    }),
    db.order.groupBy({ by: ["businessId"], where: { ...revenueStatusWhere, createdAt: { gte: start } }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.order.groupBy({ by: ["businessId"], where: { ...revenueStatusWhere, createdAt: { gte: lastStart, lt: start } }, _count: { _all: true }, _sum: { totalCents: true } }),
    db.order.groupBy({ by: ["businessId"], where: { ...revenueStatusWhere }, _sum: { totalCents: true }, _max: { createdAt: true } }),
    db.subscription.groupBy({ by: ["businessId"], where: { status: "active" }, _count: { _all: true } }),
  ]);

  const tm = new Map(thisMo.map((g) => [g.businessId, { n: g._count._all, cents: g._sum.totalCents ?? 0 }]));
  const lm = new Map(lastMo.map((g) => [g.businessId, { n: g._count._all, cents: g._sum.totalCents ?? 0 }]));
  const at = new Map(allTime.map((g) => [g.businessId, { cents: g._sum.totalCents ?? 0, last: g._max.createdAt }]));
  const subs = new Map(subGroup.map((g) => [g.businessId, g._count._all]));

  const rows = businesses.map((b) => {
    const tier = b.tier as TierKey;
    const t = tm.get(b.id) ?? { n: 0, cents: 0 };
    const l = lm.get(b.id) ?? { n: 0, cents: 0 };
    const a = at.get(b.id) ?? { cents: 0, last: null };
    const activeSubs = subs.get(b.id) ?? 0;
    const feeBps = b.settings?.platformFeeBps ?? TIERS[tier].platformFeeBps;
    const badge = billingBadge({ ...b, tier }, now);
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      ownerEmail: b.users.find((u) => u.role === "owner")?.email ?? b.users[0]?.email ?? "—",
      tier,
      badge,
      trial: trialStatus(b.trialEndsAt, now),
      ordersMo: t.n,
      mom: momentum(t.n, l.n),
      gmvMo: t.cents,
      feeMo: platformFeeCents(t.cents, feeBps),
      feeBps,
      gmvAll: a.cents,
      lastOrder: a.last,
      quiet: isQuiet(a.last, b.createdAt, now),
      activeSubs,
      customers: b._count.customers,
      setup: setupScore({ meals: b._count.meals, plans: b._count.plans, stripeConnected: b.stripeChargesEnabled, hasLogo: !!b.logoUrl, orders: b._count.orders, activeSubs }),
      stripe: b.stripeChargesEnabled,
      referredBy: b.referredByPartner,
      acqSource: b.acqSource,
      createdAt: b.createdAt,
    };
  });

  // ── platform KPIs ──
  const realMrr = rows.reduce((s, r) => s + (r.badge.paying ? TIERS[r.tier].priceCents : 0), 0);
  const potentialMrr = rows.reduce((s, r) => s + (r.badge.state === "comped" ? 0 : TIERS[r.tier].priceCents), 0);
  const gmvMonth = rows.reduce((s, r) => s + r.gmvMo, 0);
  const feesMonth = rows.reduce((s, r) => s + r.feeMo, 0);
  const trialsSoon = rows.filter((r) => r.badge.state === "trialing" && r.trial.daysLeft <= TRIAL_SOON_DAYS).length;
  const quietCount = rows.filter((r) => r.quiet).length;
  const pastDue = rows.filter((r) => r.badge.state === "past_due").length;
  const payingCount = rows.filter((r) => r.badge.paying).length;
  const new30 = rows.filter((r) => now.getTime() - r.createdAt.getTime() <= 30 * 86_400_000).length;
  const new7 = rows.filter((r) => now.getTime() - r.createdAt.getTime() <= 7 * 86_400_000).length;

  // ── acquisition (first-touch) ──
  const acqMap = new Map<string, number>();
  for (const r of rows) acqMap.set(r.acqSource || "direct", (acqMap.get(r.acqSource || "direct") ?? 0) + 1);
  const acqRows = [...acqMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
  const maxAcq = Math.max(1, ...acqRows.map((r) => r.count));

  const visible = filterKitchens(rows, filter, q);
  const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "2-digit" });
  const href = (f: KitchenFilter) => `/admin?f=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const monthLabel = now.toLocaleString("en-US", { month: "long" });

  return (
    <>
      <div className="mb-6">
        <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase mb-2" style={{ color: "var(--muted)" }}>Platform</div>
        <h1 className="disp text-[28px] leading-none font-medium" style={{ color: "var(--ink)" }}>Kitchens</h1>
        <p className="text-[13px] mt-2" style={{ color: "var(--ink-soft)" }}>
          Every kitchen on PrepFlow, what they pay, how much they sell, and where they're stuck. Demo tenants are hidden.
        </p>
      </div>

      {/* Money */}
      <div className="grid sm:grid-cols-4 gap-3.5 mb-3.5">
        <Kpi icon={<DollarSign size={16} />} label={<>Real MRR · <strong>{payingCount}</strong> paying</>} value={formatCents(realMrr)} />
        <Kpi icon={<Store size={16} />} label={<>Potential MRR · {rows.length} kitchens</>} value={formatCents(potentialMrr)} />
        <Kpi icon={<ShoppingBag size={16} />} label={`Kitchen sales (GMV) · ${monthLabel}`} value={formatCents(gmvMonth)} />
        <Kpi icon={<Percent size={16} />} label={`Platform fees earned · ${monthLabel}`} value={formatCents(feesMonth)} />
      </div>
      {/* Action items — each links to the matching filter */}
      <div className="grid sm:grid-cols-4 gap-3.5 mb-6">
        <Link href={href("trialing")}><Kpi icon={<Clock size={16} />} label={`Trials ending within ${TRIAL_SOON_DAYS} days`} value={<span style={{ color: trialsSoon ? "var(--clay)" : "var(--ink)" }}>{trialsSoon}</span>} /></Link>
        <Link href={href("quiet")}><Kpi icon={<MoonStar size={16} />} label={`Quiet · no orders in ${QUIET_DAYS}+ days`} value={<span style={{ color: quietCount ? "var(--clay)" : "var(--ink)" }}>{quietCount}</span>} /></Link>
        <Link href={href("past_due")}><Kpi icon={<AlertTriangle size={16} />} label="Past-due billing" value={<span style={{ color: pastDue ? "var(--clay)" : "var(--ink)" }}>{pastDue}</span>} /></Link>
        <Kpi icon={<Sparkles size={16} />} label={<>New kitchens · {new7} this week</>} value={new30} delta="last 30 days" />
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {KITCHEN_FILTERS.map((f) => (
          <Link
            key={f}
            href={href(f)}
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border"
            style={filter === f
              ? { background: "var(--pine)", color: "#f4f2ec", borderColor: "var(--pine)" }
              : { background: "var(--surface)", color: "var(--ink-soft)", borderColor: "var(--line)" }}
          >
            {FILTER_LABEL[f]}
          </Link>
        ))}
        <form action="/admin" className="ml-auto flex items-center gap-2">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search kitchen, slug, owner…"
              className="pl-8 pr-3 py-1.5 rounded-lg border text-[12.5px] outline-none w-[240px]"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
        </form>
      </div>

      {/* Kitchens table */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="min-w-[1240px]">
          <div
            className="grid grid-cols-[1.5fr_1.2fr_190px_110px_60px_80px_100px_90px_90px_110px_80px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}
          >
            <div>Kitchen</div>
            <div>Owner</div>
            <div>Plan · billing</div>
            <div className="text-right">Orders (mo)</div>
            <div className="text-right">Subs</div>
            <div className="text-right">Customers</div>
            <div className="text-right">Sales (mo)</div>
            <div className="text-right">Our fee</div>
            <div className="text-right">Last order</div>
            <div>Setup</div>
            <div className="text-right">Joined</div>
          </div>

          {visible.length === 0 && (
            <p className="px-4 py-8 text-[13px]" style={{ color: "var(--muted)" }}>No kitchens match this filter.</p>
          )}

          {visible.map((r) => {
            const limit = TIERS[r.tier].orderLimit;
            const Arrow = r.mom.dir === "up" ? ArrowUpRight : r.mom.dir === "down" ? ArrowDownRight : Minus;
            const momColor = r.mom.dir === "up" ? "var(--pine)" : r.mom.dir === "down" ? "var(--clay)" : "var(--muted)";
            return (
              <div
                key={r.id}
                className="grid grid-cols-[1.5fr_1.2fr_190px_110px_60px_80px_100px_90px_90px_110px_80px] gap-3 px-4 py-3 items-center"
                style={{ borderBottom: "1px solid var(--line)", opacity: r.quiet ? 0.72 : 1 }}
              >
                <div className="min-w-0">
                  <Link href={`/admin/${r.id}`} className="text-[13.5px] font-medium truncate block hover:underline" style={{ color: "var(--ink)" }}>{r.name}</Link>
                  <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                    /{r.slug ?? "—"}
                    {r.referredBy && <> · via partner <strong style={{ color: "var(--ink-soft)" }}>{r.referredBy.name}</strong></>}
                    {!r.stripe && <> · <span style={{ color: "var(--clay)" }}>Stripe not connected</span></>}
                  </div>
                </div>
                <div className="text-[12.5px] truncate" style={{ color: "var(--ink-soft)" }}>{r.ownerEmail}</div>
                <div className="flex flex-col gap-1.5 items-start">
                  <TierSelect businessId={r.id} tier={r.tier} />
                  <Badge tone={r.badge.tone} title={r.badge.detail}>{r.badge.label}</Badge>
                </div>
                <div className="text-right">
                  <div className="text-[13px] tabular-nums" style={{ color: limit && r.ordersMo >= limit ? "var(--clay)" : "var(--ink)" }}>
                    {r.ordersMo}{limit ? <span style={{ color: "var(--muted)" }}> / {limit}</span> : ""}
                  </div>
                  <div className="text-[10.5px] inline-flex items-center gap-0.5 justify-end" style={{ color: momColor }} title="vs last month">
                    <Arrow size={11} /> {r.mom.label}
                  </div>
                </div>
                <div className="text-[12.5px] text-right tabular-nums" style={{ color: "var(--ink-soft)" }}>{r.activeSubs}</div>
                <div className="text-[12.5px] text-right tabular-nums" style={{ color: "var(--ink-soft)" }}>{r.customers}</div>
                <div className="text-right">
                  <div className="text-[12.5px] tabular-nums" style={{ color: "var(--ink)" }}>{formatCents(r.gmvMo)}</div>
                  <div className="text-[10.5px]" style={{ color: "var(--muted)" }}>{formatCents(r.gmvAll)} all-time</div>
                </div>
                <div className="text-right">
                  <div className="text-[12.5px] tabular-nums" style={{ color: "var(--pine)" }}>{formatCents(r.feeMo)}</div>
                  <div className="text-[10.5px]" style={{ color: "var(--muted)" }}>{r.feeBps / 100}%</div>
                </div>
                <div className="text-[12px] text-right" style={{ color: r.quiet ? "var(--clay)" : "var(--ink-soft)" }}>{agoLabel(r.lastOrder, now)}</div>
                <div title={r.setup.items.filter((i) => !i.done).map((i) => `☐ ${i.label}`).join("\n") || "All set"}>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-14 rounded-full" style={{ background: "var(--sand)" }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${(r.setup.done / r.setup.total) * 100}%`, background: r.setup.complete ? "var(--pine)" : "var(--clay)" }} />
                    </div>
                    <span className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>{r.setup.done}/{r.setup.total}</span>
                  </div>
                </div>
                <div className="text-[11.5px] text-right" style={{ color: "var(--muted)" }}>{fmtDate.format(r.createdAt)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11.5px] mt-2 mb-6" style={{ color: "var(--muted)" }}>
        Showing {visible.length} of {rows.length}. Sales and orders exclude canceled and refunded. "Our fee" is the platform fee on this month's sales at each kitchen's rate; the monthly software fee is separate (Real MRR). Hover a badge or setup bar for detail.
      </p>

      {/* Acquisition — where kitchens come from (first-touch attribution) */}
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Compass size={15} style={{ color: "var(--pine)" }} />
          <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Where kitchens come from</span>
          <span className="text-[12px] ml-auto" style={{ color: "var(--muted)" }}>first-touch source at signup</span>
        </div>
        {acqRows.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>No signups yet.</p>
        ) : (
          <div className="space-y-2">
            {acqRows.map((r) => (
              <div key={r.source} className="grid grid-cols-[130px_1fr_auto] items-center gap-3">
                <span className="text-[12.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{sourceLabel(r.source)}</span>
                <div className="h-2 rounded-full" style={{ background: "var(--sand)" }}>
                  <div className="h-2 rounded-full" style={{ width: `${(r.count / maxAcq) * 100}%`, background: "var(--pine)" }} />
                </div>
                <span className="text-[12px] tabular-nums text-right whitespace-nowrap" style={{ color: "var(--muted)" }}>{r.count} kitchen{r.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

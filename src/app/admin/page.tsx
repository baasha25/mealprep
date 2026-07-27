import { Store, Repeat, Users, DollarSign } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { Kpi } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { TIERS, type TierKey } from "@/lib/tiers";
import { monthStart } from "@/lib/usage";
import { TierSelect } from "./tier-select";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireSuperAdmin();

  const businesses = await db.business.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { select: { email: true, role: true } },
      _count: { select: { customers: true, orders: true } },
    },
  });

  const start = monthStart();
  const [omGroup, subGroup, revGroup] = await Promise.all([
    db.order.groupBy({ by: ["businessId"], where: { createdAt: { gte: start } }, _count: { _all: true } }),
    db.subscription.groupBy({ by: ["businessId"], where: { status: "active" }, _count: { _all: true } }),
    db.order.groupBy({ by: ["businessId"], _sum: { totalCents: true } }),
  ]);
  const om = new Map(omGroup.map((g) => [g.businessId, g._count._all]));
  const activeSubs = new Map(subGroup.map((g) => [g.businessId, g._count._all]));
  const rev = new Map(revGroup.map((g) => [g.businessId, g._sum.totalCents ?? 0]));

  const totalKitchens = businesses.length;
  const totalActiveSubs = [...activeSubs.values()].reduce((s, n) => s + n, 0);
  const totalCustomers = businesses.reduce((s, b) => s + b._count.customers, 0);
  const planMrrCents = businesses.reduce((s, b) => s + TIERS[b.tier as TierKey].priceCents, 0);

  const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
  const ownerEmail = (b: (typeof businesses)[number]) =>
    b.users.find((u) => u.role === "owner")?.email ?? b.users[0]?.email ?? "—";

  return (
    <>
      <div className="mb-6">
        <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase mb-2" style={{ color: "var(--muted)" }}>
          Platform
        </div>
        <h1 className="disp text-[28px] leading-none font-medium" style={{ color: "var(--ink)" }}>
          Kitchens
        </h1>
        <p className="text-[13px] mt-2" style={{ color: "var(--ink-soft)" }}>
          Every business signed up to PrepFlow. Change a plan inline; it re-syncs their platform fee.
        </p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3.5 mb-6">
        <Kpi icon={<Store size={16} />} label="Kitchens signed up" value={totalKitchens} />
        <Kpi icon={<DollarSign size={16} />} label="Plan value / mo (potential)" value={formatCents(planMrrCents)} />
        <Kpi icon={<Repeat size={16} />} label="Active subscriptions" value={totalActiveSubs} />
        <Kpi icon={<Users size={16} />} label="Total customers" value={totalCustomers} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div
          className="hidden md:grid grid-cols-[1.3fr_1.4fr_150px_100px_70px_90px_100px_100px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}
        >
          <div>Kitchen</div>
          <div>Owner</div>
          <div>Plan</div>
          <div className="text-right">Orders (mo)</div>
          <div className="text-right">Subs</div>
          <div className="text-right">Customers</div>
          <div className="text-right">Revenue</div>
          <div className="text-right">Joined</div>
        </div>

        {businesses.map((b) => {
          const tier = b.tier as TierKey;
          const limit = TIERS[tier].orderLimit;
          const used = om.get(b.id) ?? 0;
          return (
            <div
              key={b.id}
              className="grid md:grid-cols-[1.3fr_1.4fr_150px_100px_70px_90px_100px_100px] grid-cols-2 gap-3 px-4 py-3 items-center"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{b.name}</div>
                <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>/{b.slug ?? "—"}</div>
              </div>
              <div className="text-[12.5px] truncate" style={{ color: "var(--ink-soft)" }}>{ownerEmail(b)}</div>
              <div><TierSelect businessId={b.id} tier={tier} /></div>
              <div className="text-[12.5px] text-right" style={{ color: limit && used >= limit ? "var(--clay)" : "var(--ink-soft)" }}>
                {used}{limit ? ` / ${limit}` : ""}
              </div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>{activeSubs.get(b.id) ?? 0}</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>{b._count.customers}</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink)" }}>{formatCents(rev.get(b.id) ?? 0)}</div>
              <div className="text-[12px] text-right" style={{ color: "var(--muted)" }}>{fmtDate.format(b.createdAt)}</div>
            </div>
          );
        })}
      </div>

      <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>
        “Plan value / mo” is the sum of every kitchen’s tier price — potential software MRR. Kitchen billing isn’t collected yet (that’s the last go-live step), so this is a projection.
      </p>
    </>
  );
}

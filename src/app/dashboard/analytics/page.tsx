import { TrendingUp, Receipt, Repeat, Users, ChefHat } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents, formatCents0 } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";

export default async function AnalyticsPage() {
  const { business } = await requireOwner();
  const where = { businessId: business.id };

  const [orders, customerCount, activeSubs, orderItems] = await Promise.all([
    db.order.findMany({ where, select: { totalCents: true, type: true, zone: true } }),
    db.customer.count({ where }),
    db.subscription.count({ where: { ...where, status: "active" } }),
    db.orderItem.findMany({
      where: { order: where },
      select: { nameSnapshot: true, qty: true, unitPriceCentsSnapshot: true },
    }),
  ]);

  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const aovCents = orders.length ? Math.round(revenueCents / orders.length) : 0;

  // Top meals by revenue.
  const mealMap = new Map<string, { units: number; revenueCents: number }>();
  for (const it of orderItems) {
    const cur = mealMap.get(it.nameSnapshot) ?? { units: 0, revenueCents: 0 };
    cur.units += it.qty;
    cur.revenueCents += it.qty * it.unitPriceCentsSnapshot;
    mealMap.set(it.nameSnapshot, cur);
  }
  const topMeals = [...mealMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
  const maxMealRev = Math.max(1, ...topMeals.map((m) => m.revenueCents));

  // Order mix by type.
  const typeMap = new Map<string, { count: number; revenueCents: number }>();
  for (const o of orders) {
    const cur = typeMap.get(o.type) ?? { count: 0, revenueCents: 0 };
    cur.count += 1;
    cur.revenueCents += o.totalCents;
    typeMap.set(o.type, cur);
  }
  const typeMix = [...typeMap.entries()].sort((a, b) => b[1].revenueCents - a[1].revenueCents);

  // Revenue by zone.
  const zoneMap = new Map<string, number>();
  for (const o of orders) {
    const z = o.zone ?? "—";
    zoneMap.set(z, (zoneMap.get(z) ?? 0) + o.totalCents);
  }
  const zones = [...zoneMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxZone = Math.max(1, ...zones.map(([, v]) => v));

  return (
    <Page>
      <Head kicker="Insights" title="Analytics" sub="Sales, menu performance, and subscriber mix across all orders." />

      <div className="grid sm:grid-cols-4 gap-3.5 mb-4">
        <Kpi icon={<TrendingUp size={16} />} label="Total revenue" value={formatCents0(revenueCents)} />
        <Kpi icon={<Receipt size={16} />} label="Avg order value" value={formatCents(aovCents)} />
        <Kpi icon={<Repeat size={16} />} label="Active subscribers" value={activeSubs} />
        <Kpi icon={<Users size={16} />} label="Customers" value={customerCount} />
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        <Card>
          <CardTitle icon={<ChefHat size={15} />} title="Top meals" note="by revenue" />
          {topMeals.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>No sales yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topMeals.map((m) => (
                <div key={m.name}>
                  <div className="flex justify-between text-[12.5px] mb-1">
                    <span style={{ color: "var(--ink)" }}>{m.name}</span>
                    <span style={{ color: "var(--muted)" }}>{m.units} units · {formatCents(m.revenueCents)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--sand)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${(m.revenueCents / maxMealRev) * 100}%`, background: "var(--pine)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle title="Order mix" note="by type" />
            <div className="space-y-2.5">
              {typeMix.map(([type, v]) => {
                const pct = revenueCents ? Math.round((v.revenueCents / revenueCents) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-[12.5px] w-24" style={{ color: "var(--ink)" }}>{ORDER_TYPE_LABEL[type] ?? type}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: "var(--sand)" }}>
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--clay)" }} />
                    </div>
                    <span className="text-[12px] w-9 text-right" style={{ color: "var(--muted)" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle title="Revenue by zone" />
            <div className="space-y-2.5">
              {zones.map(([zone, v]) => (
                <div key={zone} className="flex items-center gap-3">
                  <span className="text-[12.5px] w-16" style={{ color: "var(--ink)" }}>{zone}</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: "var(--sand)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${(v / maxZone) * 100}%`, background: "var(--pine)" }} />
                  </div>
                  <span className="text-[12px] w-14 text-right" style={{ color: "var(--muted)" }}>{formatCents(v)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}

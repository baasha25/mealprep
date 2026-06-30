import { TrendingUp, ChefHat, Repeat, Receipt } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents, formatCents0 } from "@/lib/money";

export default async function DashboardPage() {
  const { business } = await requireBusiness();
  const where = { businessId: business.id };

  const [orders, subCount, agg] = await Promise.all([
    db.order.count({ where }),
    db.subscription.count({ where: { ...where, status: "active" } }),
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
        title="Good morning, Chef"
        sub={`How ${business.name} is performing this period.`}
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
        <CardTitle title="Phase 0 in progress" note="pilot build" />
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Auth seam, business settings, and the menu manager are coming online.
          KPIs above read live from the database for{" "}
          <strong>{business.name}</strong> ({orders} orders seeded). Next:
          storefront, subscriptions, and Stripe Connect.
        </p>
      </Card>
    </Page>
  );
}

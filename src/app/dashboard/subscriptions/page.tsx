import { CalendarClock, Repeat, TrendingUp, XCircle } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const monthly = (p: { mealsPerWeek: number; perMealPriceCents: number }) =>
  Math.round((p.mealsPerWeek * p.perMealPriceCents * 52) / 12);

function statusBadge(status: string) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "color-mix(in srgb, var(--pine) 12%, transparent)", fg: "var(--pine)", label: "Active" },
    paused: { bg: "var(--sand)", fg: "var(--muted)", label: "Paused" },
    canceled: { bg: "color-mix(in srgb, var(--clay) 10%, transparent)", fg: "var(--clay)", label: "Canceled" },
  };
  const s = map[status] ?? map.canceled;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export default async function SubscriptionsPage() {
  const { business } = await requireOwner();
  const subs = await db.subscription.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      plan: { select: { name: true, mealsPerWeek: true, perMealPriceCents: true } },
    },
  });

  const now = Date.now();
  const active = subs.filter((s) => s.status === "active");
  const mrrCents = active.reduce((sum, s) => sum + monthly(s.plan), 0);
  const upcoming7 = active.filter(
    (s) =>
      s.nextDeliveryDate &&
      s.nextDeliveryDate.getTime() > now &&
      s.nextDeliveryDate.getTime() - now < 7 * 86_400_000,
  ).length;
  const canceled30 = subs.filter(
    (s) => s.status === "canceled" && now - s.updatedAt.getTime() < 30 * 86_400_000,
  ).length;

  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return (
    <Page>
      <Head
        kicker="Recurring"
        title="Subscriptions"
        sub="Your recurring revenue base — active plans, renewals, and churn."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi icon={<TrendingUp size={17} />} label="Monthly recurring revenue" value={formatCents(mrrCents)} />
        <Kpi icon={<Repeat size={17} />} label="Active subscriptions" value={active.length} />
        <Kpi icon={<CalendarClock size={17} />} label="Deliveries next 7 days" value={upcoming7} />
        <Kpi icon={<XCircle size={17} />} label="Canceled (30 days)" value={canceled30} />
      </div>

      <Card>
        <CardTitle icon={<Repeat size={15} />} title={`All subscriptions (${subs.length})`} />
        {subs.length === 0 ? (
          <p className="text-[13.5px] py-6 text-center" style={{ color: "var(--muted)" }}>
            No subscriptions yet. When customers subscribe to a plan, they&apos;ll appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 font-medium">Plan</th>
                  <th className="py-2 font-medium">Frequency</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Next delivery</th>
                  <th className="py-2 font-medium text-right">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="py-2.5" style={{ color: "var(--ink)" }}>
                      <div className="font-medium">{s.customer?.name ?? "—"}</div>
                      <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{s.customer?.email}</div>
                    </td>
                    <td className="py-2.5" style={{ color: "var(--ink)" }}>{s.plan.name}</td>
                    <td className="py-2.5" style={{ color: "var(--ink-soft)" }}>
                      {s.frequency === "weekly" ? "Weekly" : "Every 2 weeks"}
                    </td>
                    <td className="py-2.5">{statusBadge(s.status)}</td>
                    <td className="py-2.5" style={{ color: "var(--ink-soft)" }}>
                      {s.status === "canceled" ? "—" : s.nextDeliveryDate ? dateFmt.format(s.nextDeliveryDate) : "—"}
                    </td>
                    <td className="py-2.5 text-right" style={{ color: "var(--ink)" }}>
                      {s.status === "active" ? formatCents(monthly(s.plan)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}

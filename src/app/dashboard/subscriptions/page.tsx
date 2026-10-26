import { CalendarClock, Repeat, TrendingUp, XCircle, AlertTriangle } from "lucide-react";
import { atRiskSubscribers } from "@/lib/alerts-data";
import { RISK_LABEL } from "@/lib/insights";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { Hint } from "@/components/ui";
import { SubActions } from "./sub-actions";
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
  const nowDate = new Date();
  const subs = await db.subscription.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      plan: { select: { name: true, mealsPerWeek: true, perMealPriceCents: true } },
      // Has the subscriber picked meals for their next delivery yet?
      selections: { where: { deliveryDate: { gte: new Date(nowDate.getTime() - 86_400_000) } }, select: { deliveryDate: true, _count: { select: { items: true } } } },
    },
  });
  const picked = (s: (typeof subs)[number]) =>
    Boolean(s.nextDeliveryDate && s.selections.some((x) => x._count.items > 0 && x.deliveryDate.getTime() === s.nextDeliveryDate!.getTime()));

  const now = nowDate.getTime();
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
  // Churn signals: failed payment, stuck delivery date, paused, or no recent order.
  const risk = await atRiskSubscribers(business.id);
  const riskTone = (r: string) => (r === "payment_failed" || r === "stale_delivery" ? { bg: "color-mix(in srgb, var(--clay) 10%, transparent)", fg: "var(--clay)" } : { bg: "color-mix(in srgb, #c9a227 12%, transparent)", fg: "#8a6d1f" });

  return (
    <Page>
      <Head
        kicker="Recurring"
        title="Subscriptions"
        sub="Your recurring revenue base — active plans, renewals, and churn."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Kpi icon={<TrendingUp size={17} />} label="Monthly recurring revenue" value={formatCents(mrrCents)} />
        <Kpi icon={<Repeat size={17} />} label="Active subscriptions" value={active.length} />
        <Kpi icon={<CalendarClock size={17} />} label="Deliveries next 7 days" value={upcoming7} />
        <Kpi icon={<AlertTriangle size={17} />} label={<span className="inline-flex items-center gap-1">At risk <Hint text="Subscribers showing a churn signal: a failed payment, a delivery date that stopped advancing, a pause, or no order in a while. Reach out before they cancel." /></span>} value={risk.length} />
        <Kpi icon={<XCircle size={17} />} label="Canceled (30 days)" value={canceled30} />
      </div>

      <Card className="mb-4">
        <CardTitle icon={<AlertTriangle size={15} />} title={`At risk of churning (${risk.length})`} note="Reach out before they cancel" />
        {risk.length === 0 ? (
          <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>No churn signals right now — no failed payments, stuck deliveries, pauses, or silent subscribers.</p>
        ) : (
          <div className="space-y-2">
            {risk.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg flex-wrap" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{r.customerName}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{r.planName} · {r.frequency === "weekly" ? "weekly" : "every 2 weeks"}{r.nextDeliveryDate ? ` · next ${dateFmt.format(r.nextDeliveryDate)}` : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {r.reasons.map((reason) => {
                    const t = riskTone(reason);
                    return <span key={reason} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.fg }}>{RISK_LABEL[reason]}</span>;
                  })}
                </div>
                {r.email && (
                  <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Checking in from ${business.name}`)}`} className="text-[12px] font-medium px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--pine)" }}>
                    Email
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

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
                  <th className="py-2 font-medium"><span className="inline-flex items-center gap-1">Zone <Hint text="Their delivery zone and weekly delivery fee, set from the postal code they typed when they subscribed. Moves with them if they save an address in another zone." /></span></th>
                  <th className="py-2 font-medium"><span className="inline-flex items-center gap-1">Next delivery <Hint text="Picked = they chose meals for this delivery. Not picked yet = nothing chosen; at the cut-off they get an auto-pick from their history (or are skipped, per Settings)." /></span></th>
                  <th className="py-2 font-medium text-right">Monthly</th>
                  <th className="py-2 font-medium text-right"></th>
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
                      {s.zone ?? "—"}
                      {s.deliveryFeeCents > 0 && <span className="text-[11px]" style={{ color: "var(--muted)" }}> · {formatCents(s.deliveryFeeCents)}/wk</span>}
                    </td>
                    <td className="py-2.5" style={{ color: "var(--ink-soft)" }}>
                      {s.status === "canceled" ? "—" : s.nextDeliveryDate ? dateFmt.format(s.nextDeliveryDate) : "—"}
                      {s.status === "active" && s.nextDeliveryDate && (
                        <span className="ml-1.5 text-[10.5px] px-1.5 py-px rounded-full font-medium" style={picked(s) ? { background: "color-mix(in srgb, var(--pine) 12%, transparent)", color: "var(--pine)" } : { background: "var(--sand)", color: "var(--muted)" }}>
                          {picked(s) ? "Picked" : "Not picked yet"}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right" style={{ color: "var(--ink)" }}>
                      {s.status === "active" ? formatCents(monthly(s.plan)) : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <SubActions subscriptionId={s.id} customerName={s.customer?.name ?? "this customer"} status={s.status} />
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

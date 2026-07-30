import { Trash2, DollarSign, Layers, AlertTriangle } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents, formatCents0 } from "@/lib/money";
import { RangeFilter } from "@/components/range-filter";
import { toRangeKey, rangeWhere, rangeLabel } from "@/lib/date-range";
import { summarizeLosses, LOSS_REASON_META, type LossReason } from "@/lib/loss";
import { WasteForm } from "./waste-form";
import { DeleteLossButton } from "./delete-loss-button";

export default async function WastePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business } = await requireOwner();
  const range = toRangeKey((await searchParams).range);

  const [events, ingredients, meals] = await Promise.all([
    db.lossEvent.findMany({
      where: { businessId: business.id, ...rangeWhere(range) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, kind: true, reason: true, itemName: true, qty: true, unit: true,
        costCents: true, orderId: true, note: true, createdAt: true,
      },
    }),
    db.ingredient.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    db.meal.findMany({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const { totalCents, byReason } = summarizeLosses(
    events.map((e) => ({ reason: e.reason as LossReason, costCents: e.costCents, qty: e.qty })),
  );
  const topReason = byReason[0];
  const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

  return (
    <Page>
      <Head
        kicker="Kitchen"
        title="Waste & Loss"
        sub={`Food paid for that never became revenue — spoilage, dropped orders, remakes — ${rangeLabel(range).toLowerCase()}.`}
        right={<RangeFilter basePath="/dashboard/waste" current={range} />}
      />

      <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
        <Kpi icon={<DollarSign size={16} />} label="Total loss (period)" value={formatCents0(totalCents)} />
        <Kpi icon={<Layers size={16} />} label="Loss events" value={events.length} />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Biggest cause"
          value={topReason ? LOSS_REASON_META[topReason.reason].label : "—"}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-4">
        {/* Log form */}
        <Card>
          <CardTitle icon={<Trash2 size={15} />} title="Log a loss" note="Books the food cost" />
          <WasteForm ingredients={ingredients} meals={meals} />
        </Card>

        <div className="space-y-4">
          {/* Breakdown by reason */}
          <Card>
            <CardTitle title="Where it's going" note="by reason" />
            {byReason.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>No losses logged this period. 🎉</p>
            ) : (
              <div className="space-y-2.5">
                {byReason.map((r) => {
                  const meta = LOSS_REASON_META[r.reason];
                  const pct = totalCents ? Math.round((r.costCents / totalCents) * 100) : 0;
                  return (
                    <div key={r.reason}>
                      <div className="flex justify-between items-center text-[12.5px] mb-1">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.fg }}>
                            {meta.label}
                          </span>
                          <span style={{ color: "var(--muted)" }}>{r.count} event{r.count === 1 ? "" : "s"}</span>
                        </span>
                        <span style={{ color: "var(--ink)" }}>{formatCents(r.costCents)}</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: "var(--sand)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--clay)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent events */}
          <Card>
            <CardTitle title="Recent losses" />
            {events.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>Nothing logged yet.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--line)" }}>
                {events.slice(0, 40).map((e) => {
                  const meta = LOSS_REASON_META[e.reason as LossReason];
                  return (
                    <div key={e.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{e.itemName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ background: meta.bg, color: meta.fg }}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {e.qty}{e.unit ? ` ${e.unit}` : e.kind === "meal" ? " meal(s)" : ""}
                          {" · "}{fmtDate.format(e.createdAt)}
                          {e.orderId ? ` · order #${e.orderId.slice(-6).toUpperCase()}` : ""}
                          {e.note ? ` · ${e.note}` : ""}
                        </div>
                      </div>
                      <span className="text-[13px] font-medium shrink-0" style={{ color: "var(--clay)" }}>−{formatCents(e.costCents)}</span>
                      <DeleteLossButton id={e.id} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className="text-[11.5px] mt-4" style={{ color: "var(--muted)" }}>
        Raw-ingredient losses also decrement your on-hand stock. Finished-meal losses book the plate cost (the meal was already produced) and appear in your P&amp;L. Losses tied to an order can be logged from the order itself.
      </p>
    </Page>
  );
}

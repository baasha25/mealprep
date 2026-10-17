import Link from "next/link";
import { UtensilsCrossed, ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { CATERING_STATUS_META, formatEventDate, requestSummary, cateringCode, type CateringStatus } from "@/lib/catering";
import { requestTotals } from "@/lib/catering-data";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; statuses: CateringStatus[] | null }[] = [
  { key: "open", label: "Open", statuses: ["requested", "quoted", "approved"] },
  { key: "paid", label: "Confirmed", statuses: ["paid"] },
  { key: "declined", label: "Declined", statuses: ["declined"] },
  { key: "all", label: "All", statuses: null },
];

export default async function CateringPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { business } = await requireOwner();
  const { f } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const settings = await db.businessSettings.findUnique({ where: { businessId: business.id }, select: { cateringEnabled: true, timezone: true } });
  const tz = settings?.timezone || DEFAULT_TIMEZONE;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [rows, counts, monthRevenue] = await Promise.all([
    db.cateringRequest.findMany({
      where: { businessId: business.id, ...(filter.statuses ? { status: { in: filter.statuses } } : {}) },
      orderBy: [{ eventDate: filter.key === "declined" ? "desc" : "asc" }],
      take: 200,
    }),
    db.cateringRequest.groupBy({ by: ["status"], where: { businessId: business.id }, _count: { _all: true } }),
    db.order.aggregate({ where: { businessId: business.id, type: "catering", status: { notIn: ["canceled", "refunded", "pending"] }, createdAt: { gte: monthStart } }, _sum: { totalCents: true }, _count: { _all: true } }),
  ]);
  const count = (s: CateringStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <Page>
      <Head
        kicker="Sales"
        title="Catering"
        sub="Large and event orders. A customer asks, you quote, they approve and pay — then it runs through production like any other order."
        right={
          <Link href="/dashboard/settings#catering" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
            <SettingsIcon size={15} /> Lead time &amp; minimum
          </Link>
        }
      />

      {!settings?.cateringEnabled && (
        <div className="rounded-xl border px-4 py-3 mb-4 text-[13px] flex flex-wrap items-center justify-between gap-3" style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
          <span>
            <strong>Catering requests are off.</strong> Turn them on and your storefront shows a “Catering &amp; large orders” page with your lead time and minimum.
          </span>
          <Link href="/dashboard/settings#catering" className="px-3 py-1.5 rounded-md text-[12.5px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
            Turn on in Settings
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<UtensilsCrossed size={16} />} label="Waiting for a quote" value={count("requested")} />
        <Kpi icon={<UtensilsCrossed size={16} />} label="Waiting on the customer" value={count("quoted") + count("approved")} />
        <Kpi icon={<UtensilsCrossed size={16} />} label="Confirmed events" value={count("paid")} />
        <Kpi icon={<UtensilsCrossed size={16} />} label="Catering revenue this month" value={formatCents(monthRevenue._sum.totalCents ?? 0)} delta={monthRevenue._count._all ? `${monthRevenue._count._all} paid` : undefined} />
      </div>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/dashboard/catering?f=${x.key}`} className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: x.key === filter.key ? "var(--pine)" : "var(--line)", background: x.key === filter.key ? "color-mix(in srgb, var(--pine) 10%, transparent)" : "var(--surface)", color: "var(--ink)" }}>
            {x.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <UtensilsCrossed size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
            <p className="text-[14px]" style={{ color: "var(--ink)" }}>No {filter.key === "all" ? "" : filter.label.toLowerCase() + " "}catering requests.</p>
            <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>Requests arrive from the “Catering &amp; large orders” link on your storefront. Share it with offices and event planners.</p>
          </div>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="hidden sm:grid grid-cols-[1.4fr_1fr_1fr_1fr_auto_28px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <div>Customer</div><div>Event</div><div>Size</div><div>Status</div><div className="text-right">Quote</div><div />
          </div>
          {rows.map((r) => {
            const meta = CATERING_STATUS_META[r.status];
            const { totals } = requestTotals(r);
            return (
              <Link key={r.id} href={`/dashboard/catering/${r.id}`} className="grid sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto_28px] grid-cols-2 gap-3 px-4 py-3 items-center" style={{ borderBottom: "1px solid var(--line)" }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{r.name}{r.company ? <span style={{ color: "var(--muted)" }}> · {r.company}</span> : null}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>#{cateringCode(r.id)} · {r.fulfillment}</div>
                </div>
                <div className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>{formatEventDate(r.eventDate, tz)}{r.eventTime ? ` · ${r.eventTime}` : ""}</div>
                <div className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>{requestSummary({ headcount: r.headcount, mealCount: totals.mealCount })}</div>
                <div><span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span></div>
                <div className="disp text-[15px] font-medium text-right" style={{ color: "var(--ink)" }}>{r.status === "requested" ? <span className="text-[12px] font-normal" style={{ color: "var(--muted)" }}>~{formatCents(totals.totalCents)}</span> : formatCents(totals.totalCents)}</div>
                <ChevronRight size={15} style={{ color: "var(--muted)" }} className="justify-self-end" />
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}

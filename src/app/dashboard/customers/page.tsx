import Link from "next/link";
import { Users, ChevronRight, Repeat } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi } from "@/components/ui";
import { formatCents } from "@/lib/money";

export default async function CustomersPage() {
  const { business } = await requireBusiness();
  const customers = await db.customer.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: {
      orders: { select: { totalCents: true } },
      subscriptions: { select: { status: true } },
      _count: { select: { orders: true } },
    },
  });

  const rows = customers.map((c) => {
    const spendCents = c.orders.reduce((s, o) => s + o.totalCents, 0);
    const activeSub = c.subscriptions.some((s) => s.status === "active");
    const pausedSub = !activeSub && c.subscriptions.some((s) => s.status === "paused");
    return { ...c, spendCents, activeSub, pausedSub };
  });

  const totalSpend = rows.reduce((s, r) => s + r.spendCents, 0);
  const subscribers = rows.filter((r) => r.activeSub).length;

  return (
    <Page>
      <Head
        kicker="CRM"
        title="Customers"
        sub="Everyone who has ordered or subscribed — from the storefront, POS, or an import."
      />

      <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
        <Kpi icon={<Users size={16} />} label="Customers" value={rows.length} />
        <Kpi icon={<Repeat size={16} />} label="Active subscribers" value={subscribers} />
        <Kpi icon={<Users size={16} />} label="Lifetime revenue" value={formatCents(totalSpend)} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <Users size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>No customers yet.</p>
          <Link
            href="/dashboard/import"
            className="inline-block mt-4 px-4 py-2 rounded-lg text-[13px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            Import customers
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div
            className="hidden sm:grid grid-cols-[1.4fr_1fr_90px_110px_120px_28px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}
          >
            <div>Name</div>
            <div>Email</div>
            <div className="text-right">Orders</div>
            <div className="text-right">Spend</div>
            <div>Subscription</div>
            <div />
          </div>
          {rows.map((c) => (
            <div
              key={c.id}
              className="grid sm:grid-cols-[1.4fr_1fr_90px_110px_120px_28px] grid-cols-2 gap-3 px-4 py-3 items-center"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{c.name}</div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{c.loyaltyPoints} pts</div>
              </div>
              <div className="text-[12.5px] truncate" style={{ color: "var(--ink-soft)" }}>{c.email}</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>{c._count.orders}</div>
              <div className="disp text-[14px] font-medium text-right" style={{ color: "var(--ink)" }}>{formatCents(c.spendCents)}</div>
              <div>
                {c.activeSub ? (
                  <span className="text-[11.5px] px-2 py-0.5 rounded-md font-medium" style={{ background: "color-mix(in srgb, var(--pine) 12%, transparent)", color: "var(--pine)" }}>Active</span>
                ) : c.pausedSub ? (
                  <span className="text-[11.5px] px-2 py-0.5 rounded-md font-medium" style={{ background: "var(--sand)", color: "var(--muted)" }}>Paused</span>
                ) : (
                  <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>—</span>
                )}
              </div>
              <Link
                href={`/dashboard/customers/${c.id}`}
                className="justify-self-end grid place-items-center w-7 h-7 rounded-md"
                style={{ background: "var(--paper)" }}
                aria-label="View customer"
              >
                <ChevronRight size={14} style={{ color: "var(--muted)" }} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

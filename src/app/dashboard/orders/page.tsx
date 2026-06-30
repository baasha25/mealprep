import Link from "next/link";
import { Receipt, ChevronRight } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { StatusControl } from "./status-control";
import { updateOrderStatus } from "./actions";

export default async function OrdersPage() {
  const { business } = await requireBusiness();
  const orders = await db.order.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);

  return (
    <Page>
      <Head
        kicker="Operations"
        title="Orders"
        sub="Every order across the storefront, POS, and subscriptions."
        right={
          <div className="text-right">
            <div className="disp text-[20px] font-medium" style={{ color: "var(--ink)" }}>
              {formatCents(revenueCents)}
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </div>
          </div>
        }
      />

      {orders.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <Receipt size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            No orders yet.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          {/* Header row */}
          <div
            className="hidden sm:grid grid-cols-[1fr_120px_90px_140px_120px_28px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}
          >
            <div>Customer</div>
            <div>Type</div>
            <div>Meals</div>
            <div>Status</div>
            <div className="text-right">Total</div>
            <div />
          </div>

          {orders.map((o) => (
            <div
              key={o.id}
              className="grid sm:grid-cols-[1fr_120px_90px_140px_120px_28px] grid-cols-2 gap-3 px-4 py-3 items-center"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {o.customer?.name ?? "Guest"}
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  #{o.id.slice(-6)} ·{" "}
                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(o.createdAt)}
                </div>
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
                {ORDER_TYPE_LABEL[o.type] ?? o.type}
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
                {o._count.items}
              </div>
              <div>
                <StatusControl orderId={o.id} status={o.status} action={updateOrderStatus} />
              </div>
              <div className="disp text-[15px] font-medium text-right" style={{ color: "var(--ink)" }}>
                {formatCents(o.totalCents)}
              </div>
              <Link
                href={`/dashboard/orders/${o.id}`}
                className="justify-self-end grid place-items-center w-7 h-7 rounded-md"
                style={{ background: "var(--paper)" }}
                aria-label="View order"
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

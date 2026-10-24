import Link from "next/link";
import { Receipt, ChevronRight } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { ListSearch } from "@/components/list-search";
import { formatCents } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { ensureSubscriptionOrders } from "@/lib/subscription-orders-run";
import { StatusControl } from "./status-control";
import { updateOrderStatus } from "./actions";

const PAGE_SIZE = 100;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { business, role } = await requireBusiness();
  // Subscriber deliveries past their cut-off show up here as paid orders.
  await ensureSubscriptionOrders(business.id);
  const isStaff = role !== "owner";
  const sp = await searchParams;
  const term = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Staff don't see revenue: drop the total figure + the per-order $ column.
  const headerCols = isStaff
    ? "grid-cols-[1fr_120px_90px_140px_28px]"
    : "grid-cols-[1fr_120px_90px_140px_120px_28px]";
  const rowCols = isStaff
    ? "sm:grid-cols-[1fr_120px_90px_140px_28px]"
    : "sm:grid-cols-[1fr_120px_90px_140px_120px_28px]";

  // Search by order code (last-6 of the id) or customer name — in the database,
  // not in memory. The list is paged so a kitchen with thousands of orders
  // renders in the same time as one with twenty. Totals stay across all orders.
  const where = {
    businessId: business.id,
    ...(term
      ? {
          OR: [
            { id: { endsWith: term.replace(/^#/, "").toLowerCase() } },
            { customer: { is: { name: { contains: term, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const [orders, matchCount, totals] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.order.aggregate({ where: { businessId: business.id }, _count: { _all: true }, _sum: { totalCents: true } }),
  ]);
  const allCount = totals._count._all;
  const revenueCents = totals._sum.totalCents ?? 0;
  const shown = orders;
  const pageCount = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  const pageHref = (p: number) => `/dashboard/orders?${term ? `q=${encodeURIComponent(term)}&` : ""}page=${p}`;

  return (
    <Page>
      <Head
        kicker="Operations"
        title="Orders"
        sub="Every order across the storefront, POS, and subscriptions."
        right={
          <div className="text-right">
            {!isStaff && (
              <div className="disp text-[20px] font-medium" style={{ color: "var(--ink)" }}>
                {formatCents(revenueCents)}
              </div>
            )}
            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              {allCount} order{allCount === 1 ? "" : "s"}
            </div>
          </div>
        }
      />

      {allCount === 0 ? (
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
        <>
          <ListSearch
            placeholder="Search by order code or customer…"
            basePath="/dashboard/orders"
            initialQ={term}
          />
          {shown.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <p className="text-[13.5px]" style={{ color: "var(--muted)" }}>No orders match “{term}”.</p>
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              {/* Header row */}
              <div
                className={`hidden sm:grid ${headerCols} gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide`}
                style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}
              >
                <div>Customer</div>
                <div>Type</div>
                <div>Meals</div>
                <div>Status</div>
                {!isStaff && <div className="text-right">Total</div>}
                <div />
              </div>

              {shown.map((o) => (
            <div
              key={o.id}
              className={`grid ${rowCols} grid-cols-2 gap-3 px-4 py-3 items-center`}
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
              {!isStaff && (
                <div className="disp text-[15px] font-medium text-right" style={{ color: "var(--ink)" }}>
                  {formatCents(o.totalCents)}
                </div>
              )}
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
          {pageCount > 1 && (
            <div className="flex items-center justify-between mt-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
              <span>
                Page {page} of {pageCount} · {matchCount} {term ? "matching " : ""}order{matchCount === 1 ? "" : "s"}
              </span>
              <div className="flex gap-1.5">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="px-3 py-1.5 rounded-md border font-medium" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    ← Newer
                  </Link>
                )}
                {page < pageCount && (
                  <Link href={pageHref(page + 1)} className="px-3 py-1.5 rounded-md border font-medium" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    Older →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

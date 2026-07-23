import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { slugify } from "@/lib/slug";
import { toRangeKey, rangeWhere, rangeLabel } from "@/lib/date-range";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";

const money = (cents: number) => (cents / 100).toFixed(2);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Downloadable orders ledger for the owner's bookkeeper (respects ?range=).
export async function GET(request: Request) {
  const { business } = await requireOwner();
  const range = toRangeKey(new URL(request.url).searchParams.get("range"), "all");

  const orders = await db.order.findMany({
    where: { businessId: business.id, ...rangeWhere(range) },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true, email: true } }, _count: { select: { items: true } } },
  });

  const rows: (string | number)[][] = [
    [business.name],
    [`Orders report (${rangeLabel(range)}) — generated ${isoDate(new Date())}`],
    [],
    ["Order", "Date", "Customer", "Email", "Type", "Status", "Fulfillment", "Zone", "Meals", "Subtotal", "Tax", "Fees", "Gift redeemed", "Total", "Amount due"],
  ];
  for (const o of orders) {
    rows.push([
      o.id.slice(-6),
      isoDate(o.createdAt),
      o.customer?.name ?? "Guest",
      o.customer?.email ?? "",
      ORDER_TYPE_LABEL[o.type] ?? o.type,
      o.status,
      o.fulfillment,
      o.zone ?? "",
      o._count.items,
      money(o.subtotalCents),
      money(o.taxCents),
      money(o.feesCents),
      money(o.giftRedeemedCents),
      money(o.totalCents),
      money(Math.max(0, o.totalCents - o.giftRedeemedCents)),
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(business.name)}-orders-${isoDate(new Date())}.csv"`,
    },
  });
}

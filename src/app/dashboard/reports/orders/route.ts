import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";

const money = (cents: number) => (cents / 100).toFixed(2);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Downloadable orders ledger (all orders) for the owner's bookkeeper.
export async function GET() {
  const { business } = await requireBusiness();
  const orders = await db.order.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true, email: true } }, _count: { select: { items: true } } },
  });

  const rows: (string | number)[][] = [
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
      "content-disposition": `attachment; filename="prepflow-orders-${isoDate(new Date())}.csv"`,
    },
  });
}

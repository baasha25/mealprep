import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { slugify } from "@/lib/slug";
import { revenueStatusWhere } from "@/lib/order-status";

const money = (cents: number) => (cents / 100).toFixed(2);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Downloadable customer list (CRM / email marketing / bookkeeping).
export async function GET() {
  const { business } = await requireOwner();

  const [customers, spentAgg] = await Promise.all([
    db.customer.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { orders: true } },
        subscriptions: { select: { status: true } },
      },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { businessId: business.id, ...revenueStatusWhere },
      _sum: { totalCents: true },
    }),
  ]);

  const spentByCustomer = new Map(spentAgg.map((r) => [r.customerId, r._sum.totalCents ?? 0]));

  const rows: (string | number)[][] = [
    [business.name],
    [`Customer list — generated ${isoDate(new Date())}`],
    [],
    ["Name", "Email", "Phone", "Loyalty points", "Referral code", "Orders", "Active subscription", "Total spent", "Joined"],
  ];
  for (const c of customers) {
    const activeSub = c.subscriptions.some((s) => s.status === "active");
    rows.push([
      c.name,
      c.email,
      c.phone ?? "",
      c.loyaltyPoints,
      c.referralCode ?? "",
      c._count.orders,
      activeSub ? "yes" : "no",
      money(spentByCustomer.get(c.id) ?? 0),
      isoDate(c.createdAt),
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(business.name)}-customers-${isoDate(new Date())}.csv"`,
    },
  });
}

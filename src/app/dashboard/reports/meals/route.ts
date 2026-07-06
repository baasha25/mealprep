import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

const money = (cents: number) => (cents / 100).toFixed(2);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Downloadable meal-sales report: units and revenue per meal.
export async function GET() {
  const { business } = await requireBusiness();
  const items = await db.orderItem.findMany({
    where: { order: { businessId: business.id } },
    select: { nameSnapshot: true, qty: true, unitPriceCentsSnapshot: true },
  });

  const byMeal = new Map<string, { units: number; revenueCents: number }>();
  for (const it of items) {
    const cur = byMeal.get(it.nameSnapshot) ?? { units: 0, revenueCents: 0 };
    cur.units += it.qty;
    cur.revenueCents += it.qty * it.unitPriceCentsSnapshot;
    byMeal.set(it.nameSnapshot, cur);
  }

  const rows: (string | number)[][] = [["Meal", "Units sold", "Revenue", "Avg price"]];
  for (const [name, v] of [...byMeal.entries()].sort((a, b) => b[1].revenueCents - a[1].revenueCents)) {
    rows.push([name, v.units, money(v.revenueCents), money(v.units ? v.revenueCents / v.units : 0)]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="prepflow-meal-sales-${isoDate(new Date())}.csv"`,
    },
  });
}

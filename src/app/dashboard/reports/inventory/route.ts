import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { slugify } from "@/lib/slug";
import { bpsToPercent } from "@/lib/money";

const money = (cents: number) => (cents / 100).toFixed(2);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

// Downloadable inventory: on-hand quantities, costs, and stock value.
export async function GET() {
  const { business } = await requireOwner();

  const ingredients = await db.ingredient.findMany({
    where: { businessId: business.id },
    orderBy: { name: "asc" },
  });

  const rows: (string | number)[][] = [
    [business.name],
    [`Inventory — generated ${isoDate(new Date())}`],
    [],
    ["Ingredient", "Unit", "On hand", "Cost / unit", "Stock value", "Reorder threshold", "Default trim %", "Shelf life (days)"],
  ];
  let totalValue = 0;
  for (const i of ingredients) {
    const value = i.stockQty * i.costPerUnitCents;
    totalValue += value;
    rows.push([
      i.name,
      i.unit,
      round2(i.stockQty),
      money(i.costPerUnitCents),
      money(value),
      i.reorderThreshold ? round2(i.reorderThreshold) : "",
      bpsToPercent(i.defaultTrimBps),
      i.shelfLifeDays ?? "",
    ]);
  }
  rows.push([]);
  rows.push(["Total stock value", "", "", "", money(totalValue)]);

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(business.name)}-inventory-${isoDate(new Date())}.csv"`,
    },
  });
}

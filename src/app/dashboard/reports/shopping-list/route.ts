import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { slugify } from "@/lib/slug";
import { buildShoppingList, type PurchaseLine } from "@/lib/purchasing";
import { toPurchaseQty } from "@/lib/units";

const money = (cents: number) => (cents / 100).toFixed(2);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => (Math.round(n * 100) / 100).toString();

// Demand comes from orders awaiting production (mirrors the Purchasing screen).
const PRODUCING = ["paid", "in_production"] as const;

// Downloadable trim-aware shopping list — what to buy + dollars lost to over-buying.
export async function GET() {
  const { business } = await requireOwner();

  const orderItems = await db.orderItem.findMany({
    where: {
      order: { businessId: business.id, status: { in: [...PRODUCING] } },
      mealId: { not: null },
    },
    select: {
      qty: true,
      meal: {
        select: {
          ingredients: {
            select: {
              qty: true,
              unit: true,
              trimBps: true,
              ingredient: {
                select: { id: true, name: true, unit: true, costPerUnitCents: true, densityGPerMl: true },
              },
            },
          },
        },
      },
    },
  });

  const lines: PurchaseLine[] = [];
  for (const oi of orderItems) {
    if (!oi.meal) continue;
    for (const mi of oi.meal.ingredients) {
      const net = toPurchaseQty(mi.qty * oi.qty, mi.unit, mi.ingredient.unit, mi.ingredient.densityGPerMl).qty;
      lines.push({
        ingredientId: mi.ingredient.id,
        name: mi.ingredient.name,
        unit: mi.ingredient.unit,
        costPerUnitCents: mi.ingredient.costPerUnitCents,
        netQty: net,
        trimBps: mi.trimBps,
      });
    }
  }

  const list = buildShoppingList(lines);

  const rows: (string | number)[][] = [
    [business.name],
    [`Shopping list (orders awaiting production) — generated ${isoDate(new Date())}`],
    [],
    ["Ingredient", "Unit", "Usable needed", "Buy quantity", "Trimmed away", "Cost to buy", "Over-bought ($)"],
  ];
  for (const r of list.rows) {
    rows.push([
      r.name,
      r.unit,
      round2(r.netQty),
      round2(r.grossQty),
      round2(r.wasteQty),
      money(r.buyCostCents),
      money(r.wasteCostCents),
    ]);
  }
  rows.push([]);
  rows.push(["Total to buy", "", "", "", "", money(list.totalBuyCents), money(list.totalWasteCents)]);

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(business.name)}-shopping-list-${isoDate(new Date())}.csv"`,
    },
  });
}

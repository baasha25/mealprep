// Marketing — server-side data helpers (DB; no "use server" so nothing here is callable from the browser).

import { db } from "@/lib/db";

/** Best-selling active meals (last 60 days), falling back to the newest on the menu. */
export async function topMealNames(businessId: string, n: number): Promise<string[]> {
  const since = new Date(Date.now() - 60 * 86_400_000);
  const grouped = await db.orderItem.groupBy({
    by: ["mealId"],
    where: { mealId: { not: null }, order: { businessId, createdAt: { gte: since }, status: { notIn: ["canceled", "refunded"] } } },
    _sum: { qty: true },
    orderBy: { _sum: { qty: "desc" } },
    take: n,
  });
  const ids = grouped.map((g) => g.mealId!).filter(Boolean);
  const meals = ids.length ? await db.meal.findMany({ where: { id: { in: ids }, businessId, active: true, isAddOn: false }, select: { id: true, name: true } }) : [];
  const byId = new Map(meals.map((m) => [m.id, m.name]));
  const names = ids.map((id) => byId.get(id)).filter((x): x is string => Boolean(x));
  if (names.length >= n) return names.slice(0, n);
  const fill = await db.meal.findMany({ where: { businessId, active: true, isAddOn: false, id: { notIn: ids } }, orderBy: { createdAt: "desc" }, take: n - names.length, select: { name: true } });
  return [...names, ...fill.map((m) => m.name)].slice(0, n);
}

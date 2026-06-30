import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { Fulfillment, type PackingSlip, type MealLabel } from "./fulfillment";

const PRODUCING = ["paid", "in_production"] as const;

// Meal-prep shelf life — "best by" on labels.
const SHELF_LIFE_DAYS = 5;

export default async function FulfillmentPage() {
  const { business } = await requireBusiness();

  const orders = await db.order.findMany({
    where: { businessId: business.id, status: { in: [...PRODUCING] } },
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { name: true, allergens: true } },
      items: true,
    },
  });

  const slips: PackingSlip[] = orders.map((o) => ({
    id: o.id,
    code: o.id.slice(-6),
    customerName: o.customer?.name ?? "Guest",
    address: o.address,
    zone: o.zone,
    fulfillment: o.fulfillment,
    customerAllergens: o.customer?.allergens ?? [],
    items: o.items.map((it) => ({ name: it.nameSnapshot, qty: it.qty })),
  }));

  // Aggregate meals to label (one label per unit produced).
  const items = await db.orderItem.findMany({
    where: {
      order: { businessId: business.id, status: { in: [...PRODUCING] } },
      mealId: { not: null },
    },
    include: {
      meal: {
        select: {
          name: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          allergens: true,
          swatch: true,
        },
      },
    },
  });

  const byMeal = new Map<string, MealLabel>();
  for (const it of items) {
    if (!it.meal) continue;
    const cur = byMeal.get(it.nameSnapshot);
    if (cur) cur.qty += it.qty;
    else
      byMeal.set(it.nameSnapshot, {
        name: it.nameSnapshot,
        qty: it.qty,
        calories: it.meal.calories,
        proteinG: it.meal.proteinG,
        carbsG: it.meal.carbsG,
        fatG: it.meal.fatG,
        allergens: it.meal.allergens,
        swatch: it.meal.swatch,
      });
  }
  const labels = [...byMeal.values()].sort((a, b) => b.qty - a.qty);

  const bestBy = new Date();
  bestBy.setDate(bestBy.getDate() + SHELF_LIFE_DAYS);
  const bestByLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(bestBy);

  return (
    <Page>
      <Head
        kicker="Kitchen OS"
        title="Labels & packing"
        sub="Print nutrition/allergen labels and per-order packing slips for the production queue."
      />
      <Fulfillment
        businessName={business.name}
        slips={slips}
        labels={labels}
        bestByLabel={bestByLabel}
      />
    </Page>
  );
}

import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { parseLabelConfig } from "@/lib/labels";
import { Fulfillment, type PackingSlip, type MealLabel } from "./fulfillment";

const PRODUCING = ["paid", "in_production"] as const;

// Fallback shelf life for meals that don't set their own — "best by" on labels.
const DEFAULT_SHELF_LIFE_DAYS = 5;

function bestByLabelFor(shelfLifeDays: number | null): string {
  const d = new Date();
  d.setDate(d.getDate() + (shelfLifeDays ?? DEFAULT_SHELF_LIFE_DAYS));
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

export default async function FulfillmentPage() {
  const { business } = await requireBusiness();

  const settings = await db.businessSettings.findUnique({
    where: { businessId: business.id },
    select: { labelConfig: true },
  });
  const labelConfig = parseLabelConfig(settings?.labelConfig);

  const orders = await db.order.findMany({
    where: { businessId: business.id, status: { in: [...PRODUCING] } },
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { name: true, allergens: true } },
      items: true,
    },
  });

  const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  const slips: PackingSlip[] = orders.map((o) => {
    const itemDays = o.items.map((it) => it.deliveryDate?.getTime()).filter(Boolean);
    const isSplit = new Set(itemDays).size > 1;
    return {
      id: o.id,
      code: o.id.slice(-6),
      customerName: o.customer?.name ?? "Guest",
      address: o.address,
      zone: o.zone,
      fulfillment: o.fulfillment,
      customerAllergens: o.customer?.allergens ?? [],
      deliveryLabel: o.deliveryDate ? dayFmt.format(o.deliveryDate) : null,
      isSplit,
      items: o.items.map((it) => ({
        name: it.nameSnapshot,
        qty: it.qty,
        // Only surface a per-item day when the order is actually split.
        deliveryLabel: isSplit && it.deliveryDate ? dayFmt.format(it.deliveryDate) : null,
      })),
    };
  });

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
          shelfLifeDays: true,
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
        bestByLabel: bestByLabelFor(it.meal.shelfLifeDays),
      });
  }
  const labels = [...byMeal.values()].sort((a, b) => b.qty - a.qty);

  return (
    <Page>
      <div className="no-print">
        <Head
          kicker="Kitchen OS"
          title="Labels & packing"
          sub="Print nutrition/allergen labels and per-order packing slips for the production queue."
        />
      </div>
      <Fulfillment
        businessName={business.name}
        slips={slips}
        labels={labels}
        labelConfig={labelConfig}
      />
    </Page>
  );
}

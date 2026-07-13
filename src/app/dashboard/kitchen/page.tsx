import Link from "next/link";
import { ChefHat, ClipboardList, Flame, Salad, Soup, Boxes, Repeat, PackageCheck } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card } from "@/components/ui";

// Diet -> kitchen station (ported from the demo's STATION map).
const STATION: Record<string, string> = {
  "High Protein": "Grill",
  Keto: "Grill",
  "Low Carb": "Sauté",
  "Plant-Based": "Cold Station",
};
const STATION_ICON: Record<string, typeof Flame> = {
  Grill: Flame,
  Sauté: Soup,
  "Cold Station": Salad,
  Prep: Boxes,
};
const stationFor = (diet: string | null) => (diet && STATION[diet]) || "Prep";

// Orders that still need to be made.
const PRODUCING = ["paid", "in_production"] as const;

type MealRoll = { name: string; qty: number; diet: string | null; swatch: string };

export default async function KitchenPage() {
  const { business } = await requireBusiness();

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [items, subs] = await Promise.all([
    db.orderItem.findMany({
      where: { order: { businessId: business.id, status: { in: [...PRODUCING] } } },
      include: { meal: { select: { diet: true, swatch: true } } },
    }),
    // Active subscriptions' nearest upcoming delivery selection.
    db.subscription.findMany({
      where: { businessId: business.id, status: "active" },
      include: {
        customer: { select: { name: true } },
        selections: {
          where: { deliveryDate: { gte: startToday } },
          orderBy: { deliveryDate: "asc" },
          take: 1,
          include: { items: { include: { meal: { select: { name: true, diet: true, swatch: true } } } } },
        },
      },
    }),
  ]);

  // Roll up by meal across BOTH one-time orders and subscription selections.
  const byMeal = new Map<string, MealRoll>();
  const add = (key: string, roll: MealRoll) => {
    const cur = byMeal.get(key);
    if (cur) cur.qty += roll.qty;
    else byMeal.set(key, { ...roll });
  };
  for (const it of items) {
    add(it.mealId ?? it.nameSnapshot, {
      name: it.nameSnapshot,
      qty: it.qty,
      diet: it.meal?.diet ?? null,
      swatch: it.meal?.swatch ?? "#8a857a",
    });
  }

  // Subscription selections → production + a per-customer packing list.
  const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  const packing: { customer: string; deliveryLabel: string; items: { name: string; qty: number }[] }[] = [];
  let subMealCount = 0;
  for (const sub of subs) {
    const sel = sub.selections[0];
    if (!sel || sel.items.length === 0) continue;
    const rows: { name: string; qty: number }[] = [];
    for (const it of sel.items) {
      const name = it.meal?.name ?? "Meal";
      add(it.mealId, { name, qty: it.qty, diet: it.meal?.diet ?? null, swatch: it.meal?.swatch ?? "#8a857a" });
      rows.push({ name, qty: it.qty });
      subMealCount += it.qty;
    }
    packing.push({
      customer: sub.customer?.name ?? "Subscriber",
      deliveryLabel: dateFmt.format(sel.deliveryDate),
      items: rows,
    });
  }

  const meals = [...byMeal.values()].sort((a, b) => b.qty - a.qty);
  const byStation = new Map<string, MealRoll[]>();
  for (const m of meals) {
    const st = stationFor(m.diet);
    if (!byStation.has(st)) byStation.set(st, []);
    byStation.get(st)!.push(m);
  }

  const totalMeals = meals.reduce((s, m) => s + m.qty, 0);
  const distinctOrders = new Set(items.map((i) => i.orderId)).size;

  return (
    <Page>
      <Head
        kicker="Kitchen OS"
        title="Production"
        sub="Everything to cook — one-time orders plus what subscribers picked for their next delivery."
        right={
          <Link
            href="/dashboard/menu"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <ChefHat size={15} /> Manage menu
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<ClipboardList size={16} />} label="Meals to produce" value={totalMeals} />
        <Kpi icon={<ChefHat size={16} />} label="Orders in queue" value={distinctOrders} />
        <Kpi icon={<Repeat size={16} />} label="Subscription meals" value={subMealCount} />
        <Kpi icon={<Boxes size={16} />} label="Distinct recipes" value={meals.length} />
      </div>

      {meals.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <ClipboardList size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            Nothing in the production queue.
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
            Meals appear here from paid orders and active subscriptions&apos; upcoming deliveries.
          </p>
        </div>
      ) : (
        <div className="space-y-4 print-full">
          {[...byStation.entries()].map(([station, list]) => {
            const Icon = STATION_ICON[station] ?? Boxes;
            const stationTotal = list.reduce((s, m) => s + m.qty, 0);
            return (
              <Card key={station}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--pine)" }}>
                      <Icon size={16} />
                    </span>
                    <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                      {station}
                    </h3>
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                    {stationTotal} meals
                  </span>
                </div>
                <div className="space-y-2">
                  {list.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
                    >
                      <span
                        className="grid place-items-center min-w-9 h-8 px-2 rounded-md disp text-[15px] font-medium"
                        style={{ background: `${m.swatch}1a`, color: m.swatch }}
                      >
                        {m.qty}
                      </span>
                      <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                        {m.name}
                      </span>
                      {m.diet && (
                        <span className="ml-auto text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {m.diet}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}

          {packing.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <PackageCheck size={16} style={{ color: "var(--pine)" }} />
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                  Subscription packing ({packing.length})
                </h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {packing.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{p.customer}</span>
                      <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>{p.deliveryLabel}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.items.map((it, j) => (
                        <span
                          key={j}
                          className="text-[11.5px] px-2 py-0.5 rounded-md"
                          style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}
                        >
                          {it.qty}× {it.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Page>
  );
}

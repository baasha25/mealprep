import Link from "next/link";
import { ChefHat, ClipboardList, Flame, Salad, Soup, Boxes } from "lucide-react";
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

export default async function KitchenPage() {
  const { business } = await requireBusiness();

  const items = await db.orderItem.findMany({
    where: { order: { businessId: business.id, status: { in: [...PRODUCING] } } },
    include: { meal: { select: { diet: true, swatch: true } } },
  });

  // Roll up by meal (snapshot name keeps deleted meals visible).
  const byMeal = new Map<
    string,
    { name: string; qty: number; diet: string | null; swatch: string }
  >();
  for (const it of items) {
    const key = it.mealId ?? it.nameSnapshot;
    const cur = byMeal.get(key);
    if (cur) cur.qty += it.qty;
    else
      byMeal.set(key, {
        name: it.nameSnapshot,
        qty: it.qty,
        diet: it.meal?.diet ?? null,
        swatch: it.meal?.swatch ?? "#8a857a",
      });
  }
  const meals = [...byMeal.values()].sort((a, b) => b.qty - a.qty);

  // Group by station.
  const byStation = new Map<string, typeof meals>();
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
        sub="Everything to cook for the orders awaiting production."
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

      <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
        <Kpi icon={<ClipboardList size={16} />} label="Meals to produce" value={totalMeals} />
        <Kpi icon={<ChefHat size={16} />} label="Orders in queue" value={distinctOrders} />
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
            Orders appear here once they&apos;re marked paid or in production.
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
        </div>
      )}
    </Page>
  );
}

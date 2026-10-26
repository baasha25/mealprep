import { Truck, MapPin, Navigation, Printer } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card } from "@/components/ui";
import { Hint } from "@/components/ui";
import { DispatchCheck, type DispatchRoute } from "./dispatch-check";
import { ensureSubscriptionOrders } from "@/lib/subscription-orders-run";
import { nounsFor, countNoun } from "@/lib/nouns";
import { stopsFor, dayOptions, dayKey } from "@/lib/delivery-stops";
import { DayChips } from "@/components/day-chips";

// Orders that are headed out for delivery (paid through packed/out-for-delivery).
const ROUTABLE = ["paid", "in_production", "packed", "out_for_delivery"] as const;

export default async function RoutesPage({ searchParams }: { searchParams?: Promise<{ day?: string }> }) {
  const { business } = await requireBusiness();
  const activeDay = (await searchParams)?.day ?? "";
  // Subscriber deliveries past their cut-off are orders too — make sure they're here.
  await ensureSubscriptionOrders(business.id);
  const N = nounsFor((await db.businessSettings.findUnique({ where: { businessId: business.id }, select: { itemNoun: true } }))?.itemNoun);

  const orders = await db.order.findMany({
    where: { businessId: business.id, fulfillment: "delivery", status: { in: [...ROUTABLE] } },
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "asc" }],
    include: {
      customer: { select: { name: true } },
      items: { select: { qty: true, deliveryDate: true } },
    },
  });

  // A split order (items on two days) is two stops, one per day.
  const allStops = stopsFor(orders);
  const days = dayOptions(allStops);
  const stopsToday = allStops.filter((s) => !activeDay || (activeDay === "none" ? !s.date : dayKey(s.date) === activeDay));

  // Group into routes by delivery zone.
  const byZone = new Map<string, typeof stopsToday>();
  for (const s of stopsToday) {
    const z = s.order.zone ?? "Unzoned";
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(s);
  }
  const routes = [...byZone.entries()].sort((a, b) => b[1].length - a[1].length);
  const totalStops = stopsToday.length;
  // Dispatch checklist data — the same stops, shaped for the tick-off view.
  const checkRoutes: DispatchRoute[] = routes.map(([zone, stops]) => ({
    zone,
    stops: stops.map((s) => ({ id: s.id, name: s.order.customer?.name ?? "Guest", address: s.order.address ?? null, items: s.items })),
  }));
  const dateKey = new Date().toISOString().slice(0, 10);
  const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Page>
      <Head
        kicker="Delivery"
        title="Routes"
        sub="Today's deliveries grouped into routes by zone — a manifest for each driver."
        right={
          <span className="no-print flex items-center gap-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
            <Printer size={14} /> Print to hand off
          </span>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
        <Kpi icon={<Truck size={16} />} label="Stops" value={totalStops} />
        <Kpi icon={<Navigation size={16} />} label={<span className="inline-flex items-center gap-1">Routes (zones) <Hint text="One route per delivery zone. Orders are placed in a zone by the customer's postal code (Settings → Delivery zones); the rest land in Unzoned." /></span>} value={routes.length} />
        <Kpi icon={<MapPin size={16} />} label={`${N.Many} out`} value={stopsToday.reduce((s, x) => s + x.items, 0)} />
      </div>
      <DayChips basePath="/dashboard/routes" days={days} active={activeDay} noun={N.many} />

      {routes.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <Truck size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>No deliveries to route.</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>Delivery orders appear here once they&apos;re paid or in production.</p>
        </div>
      ) : (
        <div className="space-y-4 print-full">
          <DispatchCheck routes={checkRoutes} dateKey={dateKey} />
          {routes.map(([zone, stops]) => (
            <Card key={zone}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span style={{ color: "var(--pine)" }}><Navigation size={16} /></span>
                  <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{zone} route</h3>
                </div>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>{stops.length} stop{stops.length === 1 ? "" : "s"}</span>
              </div>
              <div className="space-y-2">
                {stops.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                    <span className="grid place-items-center w-6 h-6 rounded-full text-[12px] font-semibold shrink-0" style={{ background: "var(--pine)", color: "#f4f2ec" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{s.order.customer?.name ?? "Guest"}{s.id.includes(":") ? <span className="ml-1.5 text-[10.5px] px-1.5 py-px rounded-full font-medium align-middle" style={{ background: "var(--sand)", color: "var(--muted)" }}>split order</span> : null}</div>
                      <div className="text-[12px] truncate" style={{ color: "var(--muted)" }}>{s.order.address ?? "No address on file"}</div>
                    </div>
                    <span className="text-[12px] shrink-0" style={{ color: "var(--ink-soft)" }}>
                      {s.date ? `${dayFmt.format(s.date)} · ` : ""}{countNoun(s.items, N)} · #{s.order.id.slice(-6)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

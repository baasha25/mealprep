import { Truck, MapPin, Navigation, Printer } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card } from "@/components/ui";

// Orders that are headed out for delivery (paid through packed/out-for-delivery).
const ROUTABLE = ["paid", "in_production", "packed", "out_for_delivery"] as const;

export default async function RoutesPage() {
  const { business } = await requireBusiness();

  const orders = await db.order.findMany({
    where: { businessId: business.id, fulfillment: "delivery", status: { in: [...ROUTABLE] } },
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  // Group into routes by delivery zone.
  const byZone = new Map<string, typeof orders>();
  for (const o of orders) {
    const z = o.zone ?? "Unzoned";
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(o);
  }
  const routes = [...byZone.entries()].sort((a, b) => b[1].length - a[1].length);
  const totalStops = orders.length;

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
        <Kpi icon={<Navigation size={16} />} label="Routes (zones)" value={routes.length} />
        <Kpi icon={<MapPin size={16} />} label="Meals out" value={orders.reduce((s, o) => s + o._count.items, 0)} />
      </div>

      {routes.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <Truck size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>No deliveries to route.</p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>Delivery orders appear here once they&apos;re paid or in production.</p>
        </div>
      ) : (
        <div className="space-y-4 print-full">
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
                {stops.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                    <span className="grid place-items-center w-6 h-6 rounded-full text-[12px] font-semibold shrink-0" style={{ background: "var(--pine)", color: "#f4f2ec" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{o.customer?.name ?? "Guest"}</div>
                      <div className="text-[12px] truncate" style={{ color: "var(--muted)" }}>{o.address ?? "No address on file"}</div>
                    </div>
                    <span className="text-[12px] shrink-0" style={{ color: "var(--ink-soft)" }}>{o._count.items} meals · #{o.id.slice(-6)}</span>
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

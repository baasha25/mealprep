import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { slugify } from "@/lib/slug";
import { businessForReport } from "@/lib/report-auth";
import { picksFromSnapshot, nameWithOptions } from "@/lib/meal-options";
import { effectiveItemDate, dayKey } from "@/lib/delivery-stops";
import { stationFor } from "@/lib/stations";

const PRODUCING = ["paid", "in_production"] as const;

// The production pull-list as CSV — what to make, by delivery day and station.
// Same data as Kitchen OS; made for Google Sheets (live link) or a printout.
export async function GET(request: Request) {
  const business = await businessForReport(request);
  const items = await db.orderItem.findMany({
    where: { order: { businessId: business.id, status: { in: [...PRODUCING] } } },
    include: { meal: { select: { diet: true } }, order: { select: { deliveryDate: true, zone: true } } },
  });
  const roll = new Map<string, { day: string; station: string; meal: string; qty: number }>();
  for (const it of items) {
    const day = dayKey(effectiveItemDate(it, it.order)) || "undated";
    const meal = nameWithOptions(it.nameSnapshot, picksFromSnapshot(it.optionsSnapshot));
    const station = stationFor(it.meal?.diet ?? null);
    const k = `${day}|${station}|${meal}`;
    const cur = roll.get(k) ?? { day, station, meal, qty: 0 };
    cur.qty += it.qty;
    roll.set(k, cur);
  }
  const rows: (string | number)[][] = [["Delivery day", "Station", "Meal", "Quantity"]];
  for (const r of [...roll.values()].sort((a, b) => a.day.localeCompare(b.day) || a.station.localeCompare(b.station) || b.qty - a.qty)) rows.push([r.day, r.station, r.meal, r.qty]);
  return new Response(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${slugify(business.name)}-production-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}

// Split deliveries — pure helpers (tested).
//
// A one-time order can be split across two delivery days (each item carries
// its own deliveryDate; null = the order's date). The kitchen must then see it
// as two pull-lists and two stops, not one. These helpers resolve the
// effective date per item and expand orders into per-day stops.

export type ItemLike = { qty: number; deliveryDate?: Date | null };
export type OrderLike<I extends ItemLike = ItemLike> = { id: string; deliveryDate?: Date | null; items: I[] };

/** The day an item actually ships: its own date, else the order's. */
export function effectiveItemDate(item: ItemLike, order: { deliveryDate?: Date | null }): Date | null {
  return item.deliveryDate ?? order.deliveryDate ?? null;
}

/** Stable YYYY-MM-DD key (UTC) for grouping and ?day= links; "" for undated. */
export function dayKey(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export type Stop<O> = { id: string; order: O; date: Date | null; items: number };

/** One stop per (order, delivery day): a split order becomes two stops, each with its own item count. */
export function stopsFor<O extends OrderLike>(orders: readonly O[]): Stop<O>[] {
  const out: Stop<O>[] = [];
  for (const o of orders) {
    const byDay = new Map<string, { date: Date | null; items: number }>();
    for (const it of o.items) {
      const d = effectiveItemDate(it, o);
      const k = dayKey(d);
      const cur = byDay.get(k) ?? { date: d, items: 0 };
      cur.items += it.qty;
      byDay.set(k, cur);
    }
    if (byDay.size === 0) byDay.set(dayKey(o.deliveryDate), { date: o.deliveryDate ?? null, items: 0 });
    for (const [k, v] of byDay) out.push({ id: byDay.size > 1 ? `${o.id}:${k}` : o.id, order: o, date: v.date, items: v.items });
  }
  return out.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
}

/** "Mon Nov 2 · 3, Wed Nov 4 · 2" for a split order; null when it ships on one day. */
export function splitSummary(order: OrderLike, fmt: (d: Date) => string): string | null {
  const stops = stopsFor([order]);
  if (stops.length < 2) return null;
  return stops.map((s) => `${s.date ? fmt(s.date) : "no date"} · ${s.items}`).join(", ");
}

/** Distinct upcoming days across a set of stops, with item counts, for filter chips. */
export function dayOptions<O>(stops: readonly Stop<O>[]): { key: string; date: Date | null; items: number; stops: number }[] {
  const m = new Map<string, { key: string; date: Date | null; items: number; stops: number }>();
  for (const s of stops) {
    const k = dayKey(s.date);
    const cur = m.get(k) ?? { key: k, date: s.date, items: 0, stops: 0 };
    cur.items += s.items;
    cur.stops += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
}

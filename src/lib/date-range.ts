// Shared date-range presets for dashboard/analytics/reports filtering.
// A range resolves to a `createdAt` lower bound (null = all time).

export type RangeKey = "today" | "week" | "month" | "all";

export const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All time" },
];

export function toRangeKey(v: unknown, fallback: RangeKey = "month"): RangeKey {
  return v === "today" || v === "week" || v === "month" || v === "all" ? v : fallback;
}

/** Lower bound for a range (null = all time). Server-local time. */
export function rangeStart(key: RangeKey, now: Date = new Date()): Date | null {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  switch (key) {
    case "today":
      return midnight;
    case "week": {
      const w = new Date(midnight);
      w.setDate(w.getDate() - 6); // rolling last 7 days (incl. today)
      return w;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "all":
    default:
      return null;
  }
}

/** Prisma `createdAt` filter fragment for a range ({} when all-time). */
export function rangeWhere(key: RangeKey, now: Date = new Date()): { createdAt?: { gte: Date } } {
  const start = rangeStart(key, now);
  return start ? { createdAt: { gte: start } } : {};
}

export function rangeLabel(key: RangeKey): string {
  return RANGE_PRESETS.find((r) => r.key === key)?.label ?? "All time";
}

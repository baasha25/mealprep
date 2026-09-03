// Order-cutoff math for the storefront countdown. The cutoff is stored as a
// human string ("Sat 8:00 PM") in the KITCHEN's timezone; a live countdown needs
// the next absolute instant. All timezone conversion goes through Intl (no deps),
// with an iterative offset correction so DST transitions resolve correctly.

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Timezones a kitchen can pick (the cutoff time is interpreted in this zone).
// Curated to Canada + US regions — covers the whole target market without a
// 400-entry IANA dropdown.
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/St_Johns", label: "Newfoundland (St. John's)" },
  { value: "America/Halifax", label: "Atlantic (Halifax)" },
  { value: "America/Toronto", label: "Eastern (Toronto / Montreal)" },
  { value: "America/Winnipeg", label: "Central (Winnipeg)" },
  { value: "America/Edmonton", label: "Mountain (Calgary / Edmonton)" },
  { value: "America/Vancouver", label: "Pacific (Vancouver)" },
  { value: "America/New_York", label: "US Eastern (New York)" },
  { value: "America/Chicago", label: "US Central (Chicago)" },
  { value: "America/Denver", label: "US Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "US Pacific (Los Angeles)" },
];
export const TIMEZONE_VALUES = TIMEZONES.map((t) => t.value);
export const DEFAULT_TIMEZONE = "America/Toronto";

export type Cutoff = { day: number; hour: number; minute: number };

/** Parse "Sat 8:00 PM" → { day: 6, hour: 20, minute: 0 }. Null if unparseable. */
export function parseCutoff(s: string): Cutoff | null {
  const m = s.trim().match(/^([A-Za-z]{3,})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  const day = DAY_ABBR.findIndex((d) => d.toLowerCase() === m[1].slice(0, 3).toLowerCase());
  if (day < 0) return null;
  let hour = parseInt(m[2], 10);
  const minute = parseInt(m[3], 10);
  const ap = m[4]?.toUpperCase();
  if (ap === "PM" && hour < 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { day, hour, minute };
}

/** The wall-clock parts of a UTC instant, as seen in `tz`. */
function partsInTz(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, weekday: "short",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value])) as Record<string, string>;
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: p.hour === "24" ? 0 : +p.hour, minute: +p.minute, second: +p.second,
    weekday: DAY_ABBR.indexOf(p.weekday as (typeof DAY_ABBR)[number]),
  };
}

/** Convert a wall-clock time in `tz` to the matching UTC instant (DST-safe). */
function zonedWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let ts = target;
  for (let i = 0; i < 2; i++) {
    const p = partsInTz(new Date(ts), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    ts = target - (asUtc - ts); // subtract the offset the tz applied
  }
  return new Date(ts);
}

/**
 * Next occurrence of the cutoff (weekday + time) in `tz`, strictly after `now`.
 * Returns null if the cutoff string can't be parsed.
 */
export function nextCutoffAt(cutoffStr: string, tz: string, now: Date = new Date()): Date | null {
  const c = parseCutoff(cutoffStr);
  if (!c) return null;
  const n = partsInTz(now, tz);
  for (let add = 0; add <= 7; add++) {
    if ((n.weekday + add) % 7 !== c.day) continue;
    const instant = zonedWallTimeToUtc(n.year, n.month, n.day + add, c.hour, c.minute, tz);
    if (instant.getTime() > now.getTime()) return instant;
  }
  return null;
}

/**
 * The next enabled delivery day strictly AFTER the cutoff, at local noon in `tz`
 * (noon keeps the calendar date stable across DST for labeling). Null if none set.
 */
export function nextDeliveryAfter(
  deliveryDays: Record<string, boolean>,
  after: Date,
  tz: string,
): Date | null {
  const p = partsInTz(after, tz);
  for (let add = 1; add <= 7; add++) {
    const abbr = DAY_ABBR[(p.weekday + add) % 7];
    if (deliveryDays[abbr]) {
      return zonedWallTimeToUtc(p.year, p.month, p.day + add, 12, 0, tz);
    }
  }
  return null;
}

/**
 * Upcoming delivery dates (local noon in `tz`) landing on any of `days`
 * (weekday abbreviations like "Mon"), strictly after `after`, in chronological
 * order. For "biweekly", only every other delivery WEEK is kept — anchored on
 * the calendar week of the first upcoming delivery — so a two-day subscriber
 * still delivers on both chosen days, then skips a week. Returns up to `count`.
 */
export function upcomingDeliveries(
  days: readonly string[],
  after: Date,
  tz: string,
  count: number,
  freq: "weekly" | "biweekly" = "weekly",
): Date[] {
  const set = new Set(days);
  if (set.size === 0 || count <= 0) return [];
  const out: Date[] = [];
  const p = partsInTz(after, tz);
  let anchorWeekStart: number | null = null; // day-offset of the first kept date's (Sun-anchored) week
  const maxScan = 7 * count + 21; // enough to satisfy `count` even for biweekly multi-day
  for (let add = 1; add <= maxScan && out.length < count; add++) {
    const weekday = (p.weekday + add) % 7;
    if (!set.has(DAY_ABBR[weekday])) continue;
    // Offset of this date's Sunday, so weeks are counted by the calendar, not by
    // 7-day chunks from the anchor day (which would misalign Mon vs Thu).
    const weekStart = add - weekday;
    if (anchorWeekStart === null) anchorWeekStart = weekStart;
    const weekIndex = (weekStart - anchorWeekStart) / 7;
    if (freq === "biweekly" && weekIndex % 2 !== 0) continue;
    out.push(zonedWallTimeToUtc(p.year, p.month, p.day + add, 12, 0, tz));
  }
  return out;
}

/**
 * The chosen delivery dates in the SAME delivery week as `nextDeliveryDate`,
 * from that date forward (itself included) — i.e. the 1–2 drops the subscriber
 * can still edit this cycle. Used to split a plan across two days. Falls back to
 * just `[nextDeliveryDate]` when no days are given or none line up.
 */
export function currentCycleDeliveries(
  days: readonly string[],
  nextDeliveryDate: Date,
  tz: string,
): Date[] {
  const set = new Set(days);
  if (set.size === 0) return [nextDeliveryDate];
  const p = partsInTz(nextDeliveryDate, tz);
  const out: Date[] = [];
  // Only the rest of this Sun-anchored calendar week, so a soonest-date that's
  // (say) Thursday doesn't pull in next week's Monday.
  const daysLeftInWeek = 6 - p.weekday;
  for (let add = 0; add <= daysLeftInWeek; add++) {
    if (set.has(DAY_ABBR[(p.weekday + add) % 7])) {
      out.push(zonedWallTimeToUtc(p.year, p.month, p.day + add, 12, 0, tz));
    }
  }
  return out.length ? out : [nextDeliveryDate];
}

/** Format a date as e.g. "Sunday, Aug 30" in the given timezone. */
export function formatDeliveryLabel(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "long", month: "short", day: "numeric",
  }).format(d);
}

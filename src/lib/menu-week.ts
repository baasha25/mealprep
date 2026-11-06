// Weekly menu scheduler — pure (tested).
//
// A kitchen that rotates its menu sets which meals are on for a given week,
// plus a one-line "from the kitchen" note. A week is keyed by its Monday,
// stored as noon UTC of that calendar date so it reads as the same day in any
// North American zone (the same trick as catering event dates). No row, or a
// row with no meals, means the whole active menu, as today.

const DAY = 86_400_000;

/** Calendar date parts of `d` in `tz`. */
function partsIn(d: Date, tz: string): { y: number; m: number; day: number; weekday: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), day: Number(p.day), weekday: wd < 0 ? 0 : wd };
}

/** The Monday (noon UTC) of the week `d` falls in, by the kitchen's calendar. */
export function weekStartFor(d: Date, tz: string): Date {
  const { y, m, day, weekday } = partsIn(d, tz);
  const back = (weekday + 6) % 7; // Mon → 0, Sun → 6
  return new Date(Date.UTC(y, m - 1, day - back, 12, 0, 0));
}

export function addWeeks(weekStart: Date, n: number): Date {
  return new Date(weekStart.getTime() + n * 7 * DAY);
}

/** This week plus the next `n - 1`. */
export function upcomingWeekStarts(now: Date, tz: string, n: number): Date[] {
  const first = weekStartFor(now, tz);
  return Array.from({ length: Math.max(1, n) }, (_, i) => addWeeks(first, i));
}

/** "Nov 9–15" or "Nov 30–Dec 6". */
export function weekLabel(weekStart: Date, tz: string): string {
  const end = new Date(weekStart.getTime() + 6 * DAY);
  const md = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" });
  const a = partsIn(weekStart, tz);
  const b = partsIn(end, tz);
  if (a.m === b.m) return `${md.format(weekStart)}–${b.day}`;
  return `${md.format(weekStart)}–${md.format(end)}`;
}

export function isoWeekKey(weekStart: Date): string {
  return weekStart.toISOString().slice(0, 10);
}

export type MenuWeekLike = { mealIds: readonly string[]; note?: string | null } | null | undefined;

/** The meals on for a week: the whole list unless the week names a custom set. */
export function mealsForWeek<T extends { id: string }>(meals: readonly T[], week: MenuWeekLike): T[] {
  if (!week || week.mealIds.length === 0) return [...meals];
  const on = new Set(week.mealIds);
  return meals.filter((m) => on.has(m.id));
}

/** Does this week narrow the menu at all (for labels like "Custom · 6 meals")? */
export function isCustomWeek(week: MenuWeekLike, activeCount: number): boolean {
  return Boolean(week && week.mealIds.length > 0 && week.mealIds.length < activeCount);
}

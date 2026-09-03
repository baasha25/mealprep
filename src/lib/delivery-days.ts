// Delivery-day helpers. The kitchen enables a set of weekdays it delivers on
// (BusinessSettings.deliveryDays); a subscriber then picks which of those they
// receive on (Subscription.preferredDeliveryDays) — one day, or several. These
// pure functions keep that day-set logic (ordering, validation, labels) testable
// and free of timezone math (the date math lives in cutoff.ts).

// Canonical week order — matches the owner Settings picker (Mon → Sun).
export const DELIVERY_DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayAbbr = (typeof DELIVERY_DAY_ORDER)[number];

const FULL_NAME: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/** The kitchen's enabled delivery days, in week order (Mon → Sun). */
export function enabledDeliveryDays(map: Record<string, boolean> | null | undefined): DayAbbr[] {
  if (!map) return [];
  return DELIVERY_DAY_ORDER.filter((d) => map[d] === true);
}

/**
 * Constrain a customer's chosen days to what the kitchen actually delivers,
 * de-duplicated and returned in week order. An empty result means "not chosen"
 * (or nothing valid) — callers fall back to the kitchen's own delivery days.
 */
export function sanitizePreferredDays(
  chosen: readonly string[] | null | undefined,
  enabled: readonly string[],
): DayAbbr[] {
  const allow = new Set(enabled);
  const picked = new Set((chosen ?? []).filter((d) => allow.has(d)));
  return DELIVERY_DAY_ORDER.filter((d) => picked.has(d));
}

/** Full weekday name for an abbreviation ("Mon" → "Monday"). */
export function dayFullName(abbr: string): string {
  return FULL_NAME[abbr] ?? abbr;
}

/** Human list of days: ["Mon"] → "Mondays"; ["Mon","Thu"] → "Mondays & Thursdays". */
export function describeDeliveryDays(days: readonly string[]): string {
  const names = days.map((d) => `${dayFullName(d)}s`);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

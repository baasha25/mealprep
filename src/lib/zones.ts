// Zone-based delivery — pure helpers (tested).
//
// A kitchen defines zones by postal-code prefix ("L4C", "L4E", "M5V"), each
// with its own delivery day(s) and fee. A customer's postal code places them in
// a zone automatically; the storefront then offers only that zone's days and
// charges that zone's fee. No zones defined = the kitchen's single day set and
// flat fee, exactly as before.

export type ZoneLike = {
  id: string;
  name: string;
  postalPrefixes: string[];
  deliveryDays: Record<string, boolean>;
  deliveryFeeCents: number | null;
};

/** "l4c 1a2" → "L4C1A2"; US "90210-1234" → "902101234". */
export function normalizePostal(input: string | null | undefined): string {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Owner-typed prefixes: "L4C, l4e L4S\nM5V" → ["L4C","L4E","L4S","M5V"] (2–6 chars, de-duped). */
export function parsePrefixes(text: string | string[]): string[] {
  const parts = Array.isArray(text) ? text : text.split(/[\s,;]+/);
  const out: string[] = [];
  for (const p of parts) {
    const n = normalizePostal(p);
    if (n.length >= 2 && n.length <= 6 && !out.includes(n)) out.push(n);
  }
  return out;
}

/** The zone whose prefix matches the postal code; the longest prefix wins. Null = no zone. */
export function zoneForPostal<Z extends ZoneLike>(postal: string | null | undefined, zones: Z[]): Z | null {
  const code = normalizePostal(postal);
  if (code.length < 2) return null;
  let best: { zone: Z; len: number } | null = null;
  for (const z of zones) {
    for (const prefix of z.postalPrefixes) {
      if (code.startsWith(prefix) && (!best || prefix.length > best.len)) best = { zone: z, len: prefix.length };
    }
  }
  return best?.zone ?? null;
}

/** Has the customer typed enough to judge? (3 chars covers a Canadian FSA or a US ZIP prefix.) */
export function postalLooksComplete(postal: string | null | undefined): boolean {
  return normalizePostal(postal).length >= 3;
}

/** A zone's delivery days, falling back to the kitchen's when the zone sets none. */
export function zoneDays(zone: ZoneLike | null, kitchenDays: Record<string, boolean>): Record<string, boolean> {
  if (zone && Object.values(zone.deliveryDays ?? {}).some(Boolean)) return zone.deliveryDays;
  return kitchenDays;
}

/** A zone's fee, falling back to the kitchen's flat fee. */
export function zoneFeeCents(zone: ZoneLike | null, defaultFeeCents: number): number {
  return zone?.deliveryFeeCents ?? defaultFeeCents;
}

/** Validate an owner-edited zone list; returns clean rows or a message. */
export function validateZones(rows: { name: string; prefixes: string; days: Record<string, boolean>; feeDollars: string }[]): { ok: true; zones: { name: string; postalPrefixes: string[]; deliveryDays: Record<string, boolean>; deliveryFeeCents: number | null }[] } | { ok: false; message: string } {
  const zones = [];
  const seen = new Map<string, string>();
  for (const r of rows) {
    const name = r.name.trim().slice(0, 60);
    if (!name) return { ok: false, message: "Every zone needs a name (e.g. North, Downtown)." };
    const postalPrefixes = parsePrefixes(r.prefixes);
    if (!postalPrefixes.length) return { ok: false, message: `Zone "${name}" needs at least one postal code prefix, e.g. L4C.` };
    for (const p of postalPrefixes) {
      const owner = seen.get(p);
      if (owner && owner !== name) return { ok: false, message: `Prefix ${p} is in both "${owner}" and "${name}".` };
      seen.set(p, name);
    }
    const fee = r.feeDollars.trim();
    const feeNum = fee === "" ? null : Number(fee);
    if (feeNum !== null && (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 500)) return { ok: false, message: `Zone "${name}": the fee must be a dollar amount (blank = your default fee).` };
    zones.push({ name, postalPrefixes, deliveryDays: Object.fromEntries(Object.entries(r.days ?? {}).filter(([, v]) => v)), deliveryFeeCents: feeNum === null ? null : Math.round(feeNum * 100) });
  }
  return { ok: true, zones };
}

/**
 * The kitchen's delivery days for subscriptions and defaults. When the owner
 * ticked none but defined zones (Gaia Kitchen did exactly this), the zones'
 * days are the kitchen's days: a plan must still land on a real delivery day.
 */
export function kitchenDaysWithZones(kitchenDays: Record<string, boolean>, zones: Pick<ZoneLike, "deliveryDays">[]): Record<string, boolean> {
  if (Object.values(kitchenDays ?? {}).some(Boolean) || !zones.length) return kitchenDays ?? {};
  const union: Record<string, boolean> = {};
  for (const z of zones) for (const [d, on] of Object.entries(z.deliveryDays ?? {})) if (on) union[d] = true;
  return union;
}

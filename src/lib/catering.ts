// Catering / large orders — pure helpers (tested, no DB).
//
// Flow: a customer requests (date, headcount, meals or a description) → the
// kitchen edits a quote (lines, delivery fee, discount, note) and sends it →
// the customer approves and pays through the normal checkout → an Order of
// type "catering" exists and flows into production, labels and P&L like any
// other paid order. Nothing is charged before the kitchen has confirmed.

import { z } from "zod";

export const CATERING_STATUSES = ["requested", "quoted", "approved", "paid", "declined"] as const;
export type CateringStatus = (typeof CATERING_STATUSES)[number];

export const CATERING_STATUS_META: Record<CateringStatus, { label: string; fg: string; bg: string; hint: string }> = {
  requested: { label: "New request", fg: "#8a6d1f", bg: "#f3e9c9", hint: "Waiting for your quote" },
  quoted: { label: "Quote sent", fg: "#3f5c5a", bg: "#d6e4e3", hint: "Waiting for the customer" },
  approved: { label: "Approved · unpaid", fg: "#8a6d1f", bg: "#f3e9c9", hint: "Customer said yes; payment not in yet" },
  paid: { label: "Paid", fg: "#2f5e3f", bg: "#d9ead9", hint: "Confirmed and in production" },
  declined: { label: "Declined", fg: "#7a7268", bg: "#e7e3d8", hint: "You passed on this one" },
};

/** Owner can (re)send a quote while the customer has not yet approved. */
export function canQuote(status: CateringStatus): boolean {
  return status === "requested" || status === "quoted";
}
/** Owner can decline anything that is not paid. */
export function canDecline(status: CateringStatus): boolean {
  return status === "requested" || status === "quoted" || status === "approved";
}
/** Owner can record an offline payment (e-transfer, cash) once a quote exists. */
export function canRecordPayment(status: CateringStatus): boolean {
  return status === "quoted" || status === "approved";
}
/** Customer can approve a quote (and retry payment after approving). */
export function canApprove(status: CateringStatus): boolean {
  return status === "quoted" || status === "approved";
}

// ---- quote lines -----------------------------------------------------------

export const CateringLine = z.object({
  mealId: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(120),
  qty: z.coerce.number().int().min(1).max(10000),
  unitPriceCents: z.coerce.number().int().min(0).max(10_000_000),
});
export type CateringLineT = z.infer<typeof CateringLine>;
export const CateringLines = z.array(CateringLine).max(200);

/** Parse the JSON column defensively (bad rows are dropped, never thrown). */
export function parseLines(raw: unknown): CateringLineT[] {
  if (!Array.isArray(raw)) return [];
  const out: CateringLineT[] = [];
  for (const r of raw) {
    const p = CateringLine.safeParse(r);
    if (p.success) out.push(p.data);
  }
  return out;
}

export type QuoteTotals = {
  mealCount: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  deliveryFeeCents: number;
  totalCents: number;
};

/**
 * Money math for a quote (integer cents). Tax applies to the food after the
 * discount; the delivery fee is added untaxed — the same shape as storefront
 * orders so P&L reads both alike.
 */
export function quoteTotals(
  lines: Pick<CateringLineT, "qty" | "unitPriceCents">[],
  opts: { deliveryFeeCents?: number; discountCents?: number; taxRateBps: number },
): QuoteTotals {
  const mealCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotalCents = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
  const discountCents = Math.min(Math.max(0, opts.discountCents ?? 0), subtotalCents);
  const taxable = subtotalCents - discountCents;
  const taxCents = Math.round((taxable * opts.taxRateBps) / 10000);
  const deliveryFeeCents = mealCount > 0 ? Math.max(0, opts.deliveryFeeCents ?? 0) : 0;
  const totalCents = mealCount > 0 ? taxable + taxCents + deliveryFeeCents : 0;
  return { mealCount, subtotalCents, discountCents, taxCents, deliveryFeeCents, totalCents };
}

// ---- dates -----------------------------------------------------------------

/** Today's calendar date in `tz` as YYYY-MM-DD. */
export function todayISO(tz: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Add whole days to a YYYY-MM-DD string (calendar arithmetic, no tz drift). */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Earliest event date a customer may pick, given the kitchen's lead time. */
export function minEventDateISO(leadDays: number, tz: string, now: Date = new Date()): string {
  return addDaysISO(todayISO(tz, now), Math.max(0, leadDays));
}

/** Is a requested YYYY-MM-DD inside the lead time (and a real date)? */
export function eventDateAllowed(iso: string, leadDays: number, tz: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const back = new Date(Date.UTC(y, m - 1, d));
  if (back.toISOString().slice(0, 10) !== iso) return false; // e.g. Feb 30
  return iso >= minEventDateISO(leadDays, tz, now) && iso <= addDaysISO(todayISO(tz, now), 365);
}

/** Store an event's calendar date as noon UTC so it reads as that date in any North American zone. */
export function eventDateToInstant(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/** "Thu, Oct 30" for an event instant, in the kitchen's zone. */
export function formatEventDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
}

/** Short code shown to customers and in emails: last 6 of the id, upper-cased. */
export function cateringCode(id: string): string {
  return id.slice(-6).toUpperCase();
}

/** Human one-liner for a request's size, used in lists and emails. */
export function requestSummary(r: { headcount: number | null; mealCount: number }): string {
  const parts: string[] = [];
  if (r.mealCount > 0) parts.push(`${r.mealCount} meal${r.mealCount === 1 ? "" : "s"}`);
  if (r.headcount) parts.push(`${r.headcount} people`);
  return parts.join(" · ") || "details in notes";
}

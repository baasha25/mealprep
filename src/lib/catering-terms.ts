// Catering payment terms — pure (tested, no DB).
//
// How a quote gets paid once the client approves it:
//   card_full     — pay the whole quote by card now (default)
//   card_deposit  — pay a deposit by card now; the balance is due N days before
//                   the event (card link in the reminder, or recorded offline)
//   invoice       — corporate terms: approving issues a numbered invoice with a
//                   due date; no card needed, though card is still offered.
// Production starts when money is committed (deposit in, or invoice issued):
// the order is `confirmed`; it becomes `paid` when the last cent lands.

import { z } from "zod";
import { CateringLines, type CateringLineT } from "@/lib/catering";

export const CATERING_TERMS = ["on_approval", "net15", "net30"] as const;
export type CateringTerms = (typeof CATERING_TERMS)[number];

export const TERMS_LABEL: Record<CateringTerms, string> = {
  on_approval: "Due on approval",
  net15: "Net 15",
  net30: "Net 30",
};

export const TERMS_DAYS: Record<CateringTerms, number> = { on_approval: 0, net15: 15, net30: 30 };

export function toTerms(v: unknown): CateringTerms {
  return (CATERING_TERMS as readonly string[]).includes(String(v)) ? (v as CateringTerms) : "on_approval";
}

const DAY = 86_400_000;

/** The deposit on a quote: a share of the total, never more than the total. */
export function depositFor(totalCents: number, depositBps: number): number {
  if (totalCents <= 0 || depositBps <= 0) return 0;
  const bps = Math.min(10_000, depositBps);
  return Math.min(totalCents, Math.round((totalCents * bps) / 10_000));
}

export type PaymentPlan =
  | { mode: "card_full"; dueNowCents: number; laterCents: 0 }
  | { mode: "card_deposit"; dueNowCents: number; laterCents: number }
  | { mode: "invoice"; dueNowCents: 0; laterCents: number };

/** What the client is asked for when they approve. */
export function paymentPlan(totalCents: number, depositBps: number, terms: CateringTerms): PaymentPlan {
  if (terms !== "on_approval") return { mode: "invoice", dueNowCents: 0, laterCents: totalCents };
  const dep = depositFor(totalCents, depositBps);
  if (dep > 0 && dep < totalCents) return { mode: "card_deposit", dueNowCents: dep, laterCents: totalCents - dep };
  return { mode: "card_full", dueNowCents: totalCents, laterCents: 0 };
}

/** Balance due date: N days before the event, but never earlier than now. */
export function balanceDueAt(eventDate: Date, balanceDays: number, now: Date = new Date()): Date {
  const due = new Date(eventDate.getTime() - Math.max(0, balanceDays) * DAY);
  return due.getTime() < now.getTime() ? now : due;
}

/** Invoice due date from approval and terms. */
export function invoiceDueAt(approvedAt: Date, terms: CateringTerms): Date {
  return new Date(approvedAt.getTime() + TERMS_DAYS[terms] * DAY);
}

export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${(prefix || "INV").toUpperCase()}-${n}`;
}

/** Money already received on an order, from its payment rows. */
export function paidCents(payments: readonly { amountCents: number; status: string; refundedAmountCents?: number }[]): number {
  return payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amountCents - (p.refundedAmountCents ?? 0), 0);
}

export function outstandingCents(totalCents: number, paid: number): number {
  return Math.max(0, totalCents - paid);
}

/** Days until a due date, negative when overdue (calendar days, whole). */
export function daysUntil(due: Date, now: Date = new Date()): number {
  return Math.ceil((due.getTime() - now.getTime()) / DAY);
}

// ---- proposals with options --------------------------------------------------

export const CateringOption = z.object({
  label: z.string().trim().min(1).max(60),
  items: CateringLines,
  deliveryFeeCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  discountCents: z.coerce.number().int().min(0).max(100_000_000).default(0),
  ownerNote: z.string().trim().max(1500).nullable().default(null),
});
export type CateringOptionT = z.infer<typeof CateringOption>;
export const MAX_OPTIONS = 3;
export const CateringOptions = z.array(CateringOption).max(MAX_OPTIONS);

/** Parse the JSON column defensively (bad options are dropped). */
export function parseOptions(raw: unknown): CateringOptionT[] {
  if (!Array.isArray(raw)) return [];
  const out: CateringOptionT[] = [];
  for (const r of raw) {
    const p = CateringOption.safeParse(r);
    if (p.success) out.push(p.data);
  }
  return out.slice(0, MAX_OPTIONS);
}

/** The request fields an option fills in once the client chooses it. */
export function applyOption(o: CateringOptionT): { items: CateringLineT[]; deliveryFeeCents: number; discountCents: number; ownerNote: string | null } {
  return { items: o.items, deliveryFeeCents: o.deliveryFeeCents, discountCents: o.discountCents, ownerNote: o.ownerNote };
}

// ---- dietary counts ------------------------------------------------------------

export const DIETARY_KEYS = ["vegetarian", "vegan", "glutenFree", "dairyFree", "nutFree", "halal"] as const;
export type DietaryKey = (typeof DIETARY_KEYS)[number];
export const DIETARY_LABEL: Record<DietaryKey, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  glutenFree: "Gluten-free",
  dairyFree: "Dairy-free",
  nutFree: "Nut-free",
  halal: "Halal",
};

/** {vegetarian: 12, glutenFree: 3} from whatever was stored; zeros dropped. */
export function parseDietary(raw: unknown): Partial<Record<DietaryKey, number>> {
  const out: Partial<Record<DietaryKey, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of DIETARY_KEYS) {
    const v = Number((raw as Record<string, unknown>)[k]);
    if (Number.isFinite(v) && v > 0) out[k] = Math.min(5000, Math.round(v));
  }
  return out;
}

export function dietarySummary(d: Partial<Record<DietaryKey, number>>): string {
  return DIETARY_KEYS.filter((k) => d[k]).map((k) => `${d[k]} ${DIETARY_LABEL[k].toLowerCase()}`).join(", ");
}

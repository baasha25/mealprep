// Catering money reminders — run once a day with the other notifications.
//
// - Balance after a deposit: 3 days before the balance is due, then on the
//   due day, then once more 3 days after if still unpaid.
// - Invoice on terms: on the due day, then weekly while overdue.
// Each send is de-duplicated through SentNotification (type + request + day).

import { daysUntil, TERMS_LABEL, toTerms } from "@/lib/catering-terms";

export type CateringReminderKind = "catering_balance" | "catering_invoice";

/** Pure: which reminder, if any, a request is due today. */
export function cateringReminderDue(input: {
  status: string;
  outstandingCents: number;
  balanceDueAt: Date | null;
  invoiceDueAt: Date | null;
  now: Date;
}): CateringReminderKind | null {
  if (input.outstandingCents <= 0) return null;
  if (input.status === "deposit_paid" && input.balanceDueAt) {
    const d = daysUntil(input.balanceDueAt, input.now);
    if (d === 3 || d === 0 || d === -3) return "catering_balance";
    return null;
  }
  if (input.status === "invoiced" && input.invoiceDueAt) {
    const d = daysUntil(input.invoiceDueAt, input.now);
    if (d === 0) return "catering_invoice";
    if (d < 0 && (-d) % 7 === 0) return "catering_invoice";
    return null;
  }
  return null;
}

export type CateringReminderSummary = { scanned: number; balance: number; invoice: number };

/** DB runner (lazy imports keep the pure part unit-testable). */
export async function runCateringReminders(now: Date = new Date()): Promise<CateringReminderSummary> {
  const { db } = await import("@/lib/db");
  const { moneyState } = await import("@/lib/catering-data");
  const { sendCateringBalanceDue, sendCateringInvoice } = await import("@/lib/email");
  const { appUrl } = await import("@/lib/app-url");
  const { formatEventDate, cateringCode } = await import("@/lib/catering");
  const { DEFAULT_TIMEZONE } = await import("@/lib/cutoff");

  const summary: CateringReminderSummary = { scanned: 0, balance: 0, invoice: 0 };
  const rows = await db.cateringRequest.findMany({
    where: { status: { in: ["deposit_paid", "invoiced"] }, business: { isDemo: false } },
    include: {
      order: { select: { payments: { select: { amountCents: true, status: true, refundedAmountCents: true } } } },
      business: { select: { id: true, slug: true, name: true, brandColor: true, settings: { select: { timezone: true } } } },
    },
    take: 500,
  });
  const base = await appUrl();
  const day = now.toISOString().slice(0, 10);
  for (const r of rows) {
    summary.scanned++;
    const money = moneyState(r);
    const kind = cateringReminderDue({ status: r.status, outstandingCents: money.outstandingCents, balanceDueAt: r.balanceDueAt, invoiceDueAt: r.invoiceDueAt, now });
    if (!kind || !r.business.slug) continue;
    try {
      await db.sentNotification.create({ data: { businessId: r.business.id, type: kind, targetId: r.id, forDate: day } });
    } catch {
      continue; // already sent today
    }
    const tz = r.business.settings?.timezone || DEFAULT_TIMEZONE;
    const common = { businessId: r.business.id, to: r.email, businessName: r.business.name, brandColor: r.business.brandColor, code: cateringCode(r.id), eventDateLabel: formatEventDate(r.eventDate, tz), firstName: r.name.split(" ")[0], reminder: true };
    if (kind === "catering_invoice" && r.invoiceNumber && r.invoiceDueAt) {
      const d = daysUntil(r.invoiceDueAt, now);
      await sendCateringInvoice({
        ...common,
        invoiceNumber: r.invoiceNumber,
        dueLabel: d < 0 ? `overdue since ${formatEventDate(r.invoiceDueAt, tz)}` : "due today",
        termsLabel: TERMS_LABEL[toTerms(r.invoiceTerms)],
        totalCents: money.totalCents,
        outstandingCents: money.outstandingCents,
        invoiceUrl: `${base}/store/${r.business.slug}/catering/${r.token}/invoice`,
        quoteUrl: `${base}/store/${r.business.slug}/catering/${r.token}`,
      });
      summary.invoice++;
    } else if (kind === "catering_balance" && r.balanceDueAt) {
      const d = daysUntil(r.balanceDueAt, now);
      await sendCateringBalanceDue({
        ...common,
        balanceCents: money.outstandingCents,
        dueLabel: d < 0 ? `overdue since ${formatEventDate(r.balanceDueAt, tz)}` : d === 0 ? "due today" : `due ${formatEventDate(r.balanceDueAt, tz)}`,
        quoteUrl: `${base}/store/${r.business.slug}/catering/${r.token}`,
      });
      summary.balance++;
    }
  }
  return summary;
}

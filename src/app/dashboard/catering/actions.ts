"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, assertWritable } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { dollarsToCents, formatCents } from "@/lib/money";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { CateringLines, quoteTotals, canQuote, canDecline, canRecordPayment, cateringCode, formatEventDate, hasBalanceDue } from "@/lib/catering";
import { CateringOptions, paymentPlan, toTerms, depositFor, balanceDueAt, TERMS_LABEL, daysUntil } from "@/lib/catering-terms";
import { markCateringPaidOffline, moneyState, requestTotals, issueInvoiceForRequest } from "@/lib/catering-data";
import { sendCateringQuote, sendCateringDeclined, sendOrderConfirmation, sendCateringBalanceDue, sendCateringInvoice } from "@/lib/email";

export type QuoteActionState = { ok: boolean; message: string } | null;

const QuoteInput = z.object({
  id: z.string().min(1),
  intent: z.enum(["save", "send"]),
  lines: z.string().transform((s, ctx) => {
    try {
      const parsed = CateringLines.safeParse(JSON.parse(s || "[]"));
      if (parsed.success) return parsed.data;
    } catch {
      /* fall through */
    }
    ctx.addIssue({ code: "custom", message: "Quote lines are invalid" });
    return z.NEVER;
  }),
  // Optional alternatives (proposal with options). Option 1 is always the main quote above.
  options: z
    .string()
    .optional()
    .default("[]")
    .transform((s, ctx) => {
      try {
        const parsed = CateringOptions.safeParse(JSON.parse(s || "[]"));
        if (parsed.success) return parsed.data;
      } catch {
        /* fall through */
      }
      ctx.addIssue({ code: "custom", message: "Options are invalid" });
      return z.NEVER;
    }),
  deliveryFee: z.coerce.number().min(0).max(100000),
  discount: z.coerce.number().min(0).max(1_000_000),
  ownerNote: z.string().trim().max(1500).optional().default(""),
});

/** Save the quote as a draft, or save + send it to the customer. */
export async function saveQuote(_prev: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const parsed = QuoteInput.safeParse({
    id: formData.get("id"),
    intent: formData.get("intent"),
    lines: formData.get("lines"),
    options: formData.get("options") ?? "[]",
    deliveryFee: formData.get("deliveryFee"),
    discount: formData.get("discount"),
    ownerNote: formData.get("ownerNote") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the quote." };
  const d = parsed.data;

  const r = await db.cateringRequest.findFirst({
    where: { id: d.id, businessId: business.id },
    include: { business: { select: { slug: true, name: true, brandColor: true, settings: { select: { taxRateBps: true, timezone: true, cateringDepositBps: true, cateringTerms: true, cateringBalanceDays: true } } } } },
  });
  if (!r) return { ok: false, message: "Request not found." };
  if (!canQuote(r.status)) return { ok: false, message: "This request has already been approved — the quote is locked." };

  const st = r.business.settings;
  const taxRateBps = st?.taxRateBps ?? r.taxRateBps;
  const totals = quoteTotals(d.lines, { deliveryFeeCents: dollarsToCents(d.deliveryFee), discountCents: dollarsToCents(d.discount), taxRateBps });
  if (d.intent === "send" && totals.mealCount === 0) return { ok: false, message: "Add at least one line before sending a quote." };

  // The alternatives: option 1 is the main quote; extra options carry their own lines.
  const extraOptions = d.options.filter((o) => o.items.length > 0);
  const options = extraOptions.length
    ? [{ label: "Option 1", items: d.lines, deliveryFeeCents: totals.deliveryFeeCents, discountCents: totals.discountCents, ownerNote: d.ownerNote || null }, ...extraOptions]
    : [];
  // Terms are snapshotted when the quote goes out, so a later settings change
  // never moves a quote the client already has.
  const depositBps = st?.cateringDepositBps ?? 0;
  const terms = toTerms(st?.cateringTerms);

  const resend = r.status === "quoted";
  await db.cateringRequest.update({
    where: { id: r.id },
    data: {
      items: d.lines,
      options: options.length ? options : undefined,
      chosenOption: options.length ? null : undefined,
      deliveryFeeCents: totals.deliveryFeeCents,
      discountCents: totals.discountCents,
      taxRateBps,
      ownerNote: d.ownerNote || null,
      ...(d.intent === "send"
        ? { status: "quoted", quotedAt: new Date(), depositBps, depositCents: depositFor(totals.totalCents, depositBps), invoiceTerms: terms }
        : {}),
    },
  });

  if (d.intent === "send") {
    const base = await appUrl();
    const tz = st?.timezone || DEFAULT_TIMEZONE;
    const plan = paymentPlan(totals.totalCents, depositBps, terms);
    const planLine =
      plan.mode === "invoice"
        ? `Approve it to confirm your date; we'll invoice you on ${TERMS_LABEL[terms]} terms.`
        : plan.mode === "card_deposit"
          ? `Approve it and pay a ${formatCents(plan.dueNowCents)} deposit to lock in your date; the balance of ${formatCents(plan.laterCents)} is due ${formatEventDate(balanceDueAt(r.eventDate, st?.cateringBalanceDays ?? 7), tz)}.`
          : null;
    await sendCateringQuote({
      businessId: business.id,
      to: r.email,
      businessName: r.business.name,
      brandColor: r.business.brandColor,
      code: cateringCode(r.id),
      eventDateLabel: formatEventDate(r.eventDate, tz),
      firstName: r.name.split(" ")[0],
      quoteUrl: `${base}/store/${r.business.slug}/catering/${r.token}`,
      items: d.lines.map((l) => ({ nameSnapshot: l.name, qty: l.qty, unitPriceCentsSnapshot: l.unitPriceCents })),
      ...totals,
      ownerNote: d.ownerNote || null,
      resend,
      planLine,
      options: options.map((o) => ({ label: o.label, totalCents: quoteTotals(o.items, { deliveryFeeCents: o.deliveryFeeCents, discountCents: o.discountCents, taxRateBps }).totalCents })),
    });
  }

  revalidatePath("/dashboard/catering");
  revalidatePath(`/dashboard/catering/${r.id}`);
  return { ok: true, message: d.intent === "send" ? (resend ? "Updated quote sent." : "Quote sent to the customer.") : "Draft saved." };
}

/** Decline a request (any time before payment) and tell the customer. */
export async function declineRequest(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const r = await db.cateringRequest.findFirst({ where: { id, businessId: business.id }, include: { business: { select: { slug: true, name: true, brandColor: true, settings: { select: { timezone: true } } } } } });
  if (!r || !canDecline(r.status)) return;
  await db.$transaction([
    db.cateringRequest.update({ where: { id: r.id }, data: { status: "declined", declinedAt: new Date(), declineReason: reason || null } }),
    // An approved-but-unpaid (or invoiced-but-unpaid) order is abandoned with the request.
    ...(r.orderId ? [db.order.updateMany({ where: { id: r.orderId, businessId: business.id, status: { in: ["pending", "confirmed"] } }, data: { status: "canceled" } })] : []),
  ]);
  const base = await appUrl();
  await sendCateringDeclined({
    businessId: business.id,
    to: r.email,
    businessName: r.business.name,
    brandColor: r.business.brandColor,
    code: cateringCode(r.id),
    eventDateLabel: formatEventDate(r.eventDate, r.business.settings?.timezone || DEFAULT_TIMEZONE),
    firstName: r.name.split(" ")[0],
    reason: reason || null,
    storeUrl: `${base}/store/${r.business.slug}`,
  });
  revalidatePath("/dashboard/catering");
  revalidatePath(`/dashboard/catering/${r.id}`);
}

/**
 * The customer paid outside Stripe (e-transfer, cash, cheque, invoice): record
 * the amount. Blank amount = whatever is still outstanding. A partial amount
 * confirms the event (deposit); the last payment settles it and sends the receipt.
 */
export async function recordOfflinePayment(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const id = String(formData.get("id") ?? "");
  const method = String(formData.get("method") ?? "e-transfer").trim().slice(0, 40) || "e-transfer";
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountCents = amountRaw ? dollarsToCents(Number(amountRaw)) : null;
  const r = await db.cateringRequest.findFirst({ where: { id, businessId: business.id }, select: { id: true, status: true } });
  if (!r || !canRecordPayment(r.status)) return;
  const res = await markCateringPaidOffline(r.id, business.id, method, amountCents);
  if (res.ok && res.settled) await sendOrderConfirmation(res.orderId);
  revalidatePath("/dashboard/catering");
  revalidatePath(`/dashboard/catering/${r.id}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/kitchen");
}

/** Nudge the client: balance after a deposit, or an outstanding invoice. */
export async function sendPaymentReminder(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const id = String(formData.get("id") ?? "");
  const r = await db.cateringRequest.findFirst({
    where: { id, businessId: business.id },
    include: { order: { select: { payments: { select: { amountCents: true, status: true, refundedAmountCents: true } } } }, business: { select: { slug: true, name: true, brandColor: true, settings: { select: { timezone: true } } } } },
  });
  if (!r || !hasBalanceDue(r.status)) return;
  const money = moneyState(r);
  if (money.outstandingCents <= 0) return;
  const tz = r.business.settings?.timezone || DEFAULT_TIMEZONE;
  const base = await appUrl();
  const common = { businessId: business.id, to: r.email, businessName: r.business.name, brandColor: r.business.brandColor, code: cateringCode(r.id), eventDateLabel: formatEventDate(r.eventDate, tz), firstName: r.name.split(" ")[0], reminder: true };
  if (r.status === "invoiced" && r.invoiceNumber && r.invoiceDueAt) {
    const days = daysUntil(r.invoiceDueAt);
    await sendCateringInvoice({
      ...common,
      invoiceNumber: r.invoiceNumber,
      dueLabel: days < 0 ? `overdue since ${formatEventDate(r.invoiceDueAt, tz)}` : days === 0 ? "due today" : `due ${formatEventDate(r.invoiceDueAt, tz)}`,
      termsLabel: TERMS_LABEL[toTerms(r.invoiceTerms)],
      totalCents: money.totalCents,
      outstandingCents: money.outstandingCents,
      invoiceUrl: `${base}/store/${r.business.slug}/catering/${r.token}/invoice`,
      quoteUrl: `${base}/store/${r.business.slug}/catering/${r.token}`,
    });
  } else {
    const due = r.balanceDueAt;
    await sendCateringBalanceDue({
      ...common,
      balanceCents: money.outstandingCents,
      dueLabel: due ? (daysUntil(due) < 0 ? `overdue since ${formatEventDate(due, tz)}` : `due ${formatEventDate(due, tz)}`) : "due before the event",
      quoteUrl: `${base}/store/${r.business.slug}/catering/${r.token}`,
    });
  }
  revalidatePath(`/dashboard/catering/${r.id}`);
}

/** Owner approves on the client's behalf on net terms (phone / email yes): issues the invoice. */
export async function issueInvoice(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const id = String(formData.get("id") ?? "");
  const r = await db.cateringRequest.findFirst({ where: { id, businessId: business.id }, include: { business: { select: { slug: true, name: true, brandColor: true, settings: { select: { timezone: true } } } } } });
  if (!r || !(r.status === "quoted" || r.status === "approved")) return;
  const inv = await issueInvoiceForRequest(r.id, business.id);
  if (!inv.ok) return;
  const tz = r.business.settings?.timezone || DEFAULT_TIMEZONE;
  const base = await appUrl();
  const { totals } = requestTotals(r);
  const days = daysUntil(inv.dueAt);
  await sendCateringInvoice({
    businessId: business.id,
    to: r.email,
    businessName: r.business.name,
    brandColor: r.business.brandColor,
    code: cateringCode(r.id),
    eventDateLabel: formatEventDate(r.eventDate, tz),
    firstName: r.name.split(" ")[0],
    invoiceNumber: inv.invoiceNumber,
    dueLabel: days <= 0 ? "due now" : `due ${formatEventDate(inv.dueAt, tz)}`,
    termsLabel: TERMS_LABEL[toTerms(r.invoiceTerms)],
    totalCents: totals.totalCents,
    outstandingCents: totals.totalCents,
    invoiceUrl: `${base}/store/${r.business.slug}/catering/${r.token}/invoice`,
    quoteUrl: `${base}/store/${r.business.slug}/catering/${r.token}`,
  });
  revalidatePath("/dashboard/catering");
  revalidatePath(`/dashboard/catering/${r.id}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/kitchen");
}

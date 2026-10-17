"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, assertWritable } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { dollarsToCents } from "@/lib/money";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { CateringLines, quoteTotals, canQuote, canDecline, canRecordPayment, cateringCode, formatEventDate } from "@/lib/catering";
import { markCateringPaidOffline } from "@/lib/catering-data";
import { sendCateringQuote, sendCateringDeclined, sendOrderConfirmation } from "@/lib/email";

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
    deliveryFee: formData.get("deliveryFee"),
    discount: formData.get("discount"),
    ownerNote: formData.get("ownerNote") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the quote." };
  const d = parsed.data;

  const r = await db.cateringRequest.findFirst({ where: { id: d.id, businessId: business.id }, include: { business: { select: { slug: true, name: true, brandColor: true, settings: { select: { taxRateBps: true, timezone: true } } } } } });
  if (!r) return { ok: false, message: "Request not found." };
  if (!canQuote(r.status)) return { ok: false, message: "This request has already been approved — the quote is locked." };

  const taxRateBps = r.business.settings?.taxRateBps ?? r.taxRateBps;
  const totals = quoteTotals(d.lines, { deliveryFeeCents: dollarsToCents(d.deliveryFee), discountCents: dollarsToCents(d.discount), taxRateBps });
  if (d.intent === "send" && totals.mealCount === 0) return { ok: false, message: "Add at least one line before sending a quote." };

  const resend = r.status === "quoted";
  await db.cateringRequest.update({
    where: { id: r.id },
    data: {
      items: d.lines,
      deliveryFeeCents: totals.deliveryFeeCents,
      discountCents: totals.discountCents,
      taxRateBps,
      ownerNote: d.ownerNote || null,
      ...(d.intent === "send" ? { status: "quoted", quotedAt: new Date() } : {}),
    },
  });

  if (d.intent === "send") {
    const base = await appUrl();
    await sendCateringQuote({
      to: r.email,
      businessName: r.business.name,
      brandColor: r.business.brandColor,
      code: cateringCode(r.id),
      eventDateLabel: formatEventDate(r.eventDate, r.business.settings?.timezone || DEFAULT_TIMEZONE),
      firstName: r.name.split(" ")[0],
      quoteUrl: `${base}/store/${r.business.slug}/catering/${r.token}`,
      items: d.lines.map((l) => ({ nameSnapshot: l.name, qty: l.qty, unitPriceCentsSnapshot: l.unitPriceCents })),
      ...totals,
      ownerNote: d.ownerNote || null,
      resend,
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
    // An approved-but-unpaid order is abandoned with the request.
    ...(r.orderId ? [db.order.updateMany({ where: { id: r.orderId, businessId: business.id, status: "pending" }, data: { status: "canceled" } })] : []),
  ]);
  const base = await appUrl();
  await sendCateringDeclined({
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

/** The customer paid outside Stripe (e-transfer, cash, cheque): confirm the order. */
export async function recordOfflinePayment(formData: FormData): Promise<void> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const id = String(formData.get("id") ?? "");
  const method = String(formData.get("method") ?? "e-transfer").trim().slice(0, 40) || "e-transfer";
  const r = await db.cateringRequest.findFirst({ where: { id, businessId: business.id }, select: { id: true, status: true } });
  if (!r || !canRecordPayment(r.status)) return;
  const res = await markCateringPaidOffline(r.id, business.id, method);
  if (res.ok) await sendOrderConfirmation(res.orderId);
  revalidatePath("/dashboard/catering");
  revalidatePath(`/dashboard/catering/${r.id}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/kitchen");
}

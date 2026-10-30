import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, CalendarDays, Users, ExternalLink, FileText, ClipboardList, BellRing } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Card, CardTitle, Row } from "@/components/ui";
import { formatCents, centsToDollars } from "@/lib/money";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { CATERING_STATUS_META, formatEventDate, cateringCode, canQuote, canDecline, canRecordPayment, parseLines, hasBalanceDue } from "@/lib/catering";
import { parseOptions, parseDietary, dietarySummary, toTerms, TERMS_LABEL, daysUntil } from "@/lib/catering-terms";
import { requestTotals, moneyState } from "@/lib/catering-data";
import { QuoteEditor } from "./quote-editor";
import { declineRequest, recordOfflinePayment, sendPaymentReminder, issueInvoice } from "../actions";

export const dynamic = "force-dynamic";

export default async function CateringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireOwner();
  const [r, settings, menu] = await Promise.all([
    db.cateringRequest.findFirst({ where: { id, businessId: business.id }, include: { order: { select: { id: true, status: true, totalCents: true, payments: { select: { amountCents: true, status: true, refundedAmountCents: true, stripeChargeId: true, createdAt: true } } } } } }),
    db.businessSettings.findUnique({ where: { businessId: business.id }, select: { timezone: true, taxRateBps: true, deliveryFeeCents: true, cateringDepositBps: true, cateringTerms: true, cateringBalanceDays: true } }),
    db.meal.findMany({ where: { businessId: business.id, active: true }, orderBy: [{ perGuest: "desc" }, { isAddOn: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, priceCents: true, perGuest: true } }),
  ]);
  if (!r) notFound();
  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  const meta = CATERING_STATUS_META[r.status];
  const { totals } = requestTotals(r);
  const lines = parseLines(r.items);
  const options = parseOptions(r.options);
  const dietary = parseDietary(r.dietary);
  const money = moneyState(r);
  const locked = !canQuote(r.status);
  const quoteUrl = `/store/${business.slug}/catering/${r.token}`;
  const terms = toTerms(r.status === "requested" ? settings?.cateringTerms : (r.invoiceTerms ?? settings?.cateringTerms));
  const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "medium" });

  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
  const timeline: [string, Date | null][] = [
    ["Requested", r.createdAt],
    ["Quote sent", r.quotedAt],
    ["Approved", r.approvedAt],
    ["Invoice issued", r.invoiceSentAt],
    ["Deposit paid", r.depositPaidAt && r.depositPaidAt.getTime() !== r.paidAt?.getTime() ? r.depositPaidAt : null],
    ["Paid in full", r.paidAt],
    ["Declined", r.declinedAt],
  ];
  const balanceDue = r.balanceDueAt ? daysUntil(r.balanceDueAt) : null;
  const invoiceDue = r.invoiceDueAt ? daysUntil(r.invoiceDueAt) : null;

  return (
    <Page>
      <Link href="/dashboard/catering" className="inline-flex items-center gap-1.5 text-[12.5px] mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> All catering requests
      </Link>
      <Head
        kicker="Catering"
        title={<>Request #{cateringCode(r.id)}</>}
        sub={`${r.name}${r.company ? ` · ${r.company}` : ""} · ${formatEventDate(r.eventDate, tz)}${r.eventTime ? ` · ${r.eventTime}` : ""}`}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ color: meta.fg, background: meta.bg }} title={meta.hint}>{meta.label}</span>
            <Link href={`/dashboard/catering/${r.id}/sheet`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              <ClipboardList size={13} /> Event sheet
            </Link>
            {r.invoiceNumber && (
              <a href={`${quoteUrl}/invoice`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                <FileText size={13} /> Invoice {r.invoiceNumber}
              </a>
            )}
            <a href={quoteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium" style={{ color: "var(--pine)" }}>
              Customer view <ExternalLink size={13} />
            </a>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-4 items-start">
        <div className="space-y-4">
          <Card>
            <CardTitle title="The request" />
            <div className="space-y-2 text-[13.5px]" style={{ color: "var(--ink)" }}>
              <div className="flex items-center gap-2"><CalendarDays size={14} style={{ color: "var(--muted)" }} /> {formatEventDate(r.eventDate, tz)}{r.eventTime ? ` at ${r.eventTime}` : ""}{r.deliveryWindow ? ` · arrive ${r.deliveryWindow}` : ""}</div>
              {r.headcount ? <div className="flex items-center gap-2"><Users size={14} style={{ color: "var(--muted)" }} /> {r.headcount} people{dietarySummary(dietary) ? <span style={{ color: "var(--ink-soft)" }}> · {dietarySummary(dietary)}</span> : null}</div> : null}
              <div className="flex items-center gap-2"><MapPin size={14} style={{ color: "var(--muted)" }} /> {r.fulfillment === "pickup" ? "Pickup" : r.address ?? "Delivery"}</div>
              <div className="flex items-center gap-2"><Mail size={14} style={{ color: "var(--muted)" }} /> <a href={`mailto:${r.email}`} style={{ color: "var(--pine)" }}>{r.email}</a></div>
              {r.phone ? <div className="flex items-center gap-2"><Phone size={14} style={{ color: "var(--muted)" }} /> <a href={`tel:${r.phone}`} style={{ color: "var(--pine)" }}>{r.phone}</a></div> : null}
            </div>
            {r.notes && (
              <div className="mt-3 rounded-lg px-3.5 py-3 text-[13px] whitespace-pre-wrap" style={{ background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink)" }}>{r.notes}</div>
            )}
          </Card>

          {/* Money: what's committed, what's in, what's still owed */}
          {r.order && (
            <Card>
              <CardTitle title="Money" note={r.invoiceNumber ? `${r.invoiceNumber} · ${TERMS_LABEL[toTerms(r.invoiceTerms)]}` : r.depositBps > 0 ? `${Math.round(r.depositBps / 100)}% deposit` : undefined} />
              <div className="space-y-1 text-[13px]">
                <Row l="Quote total" v={formatCents(money.totalCents)} />
                <Row l="Received" v={formatCents(money.paidCents)} />
                <div className="flex justify-between text-[15px] font-semibold pt-1" style={{ color: money.outstandingCents > 0 ? "var(--clay)" : "var(--pine)" }}>
                  <span>{money.outstandingCents > 0 ? "Outstanding" : "Settled"}</span><span>{formatCents(money.outstandingCents)}</span>
                </div>
                {r.status === "deposit_paid" && r.balanceDueAt && (
                  <p className="text-[12.5px] pt-1" style={{ color: balanceDue !== null && balanceDue < 0 ? "var(--clay)" : "var(--ink-soft)" }}>
                    Balance {balanceDue !== null && balanceDue < 0 ? "was due" : "due"} {dateFmt.format(r.balanceDueAt)}{balanceDue !== null ? balanceDue < 0 ? ` (${-balanceDue} days overdue)` : balanceDue === 0 ? " (today)" : ` (in ${balanceDue} days)` : ""}. Reminders go out automatically 3 days before, on the day, and 3 days after.
                  </p>
                )}
                {r.status === "invoiced" && r.invoiceDueAt && (
                  <p className="text-[12.5px] pt-1" style={{ color: invoiceDue !== null && invoiceDue < 0 ? "var(--clay)" : "var(--ink-soft)" }}>
                    Invoice {invoiceDue !== null && invoiceDue < 0 ? "was due" : "due"} {dateFmt.format(r.invoiceDueAt)}{invoiceDue !== null && invoiceDue < 0 ? ` (${-invoiceDue} days overdue; weekly reminders)` : ""}.
                  </p>
                )}
              </div>
              {r.order.payments.length > 0 && (
                <div className="mt-3 pt-3 space-y-1 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                  {r.order.payments.map((p, i) => (
                    <div key={i} className="flex justify-between"><span>{when.format(p.createdAt)} · {p.stripeChargeId?.startsWith("offline:") ? p.stripeChargeId.slice(8) : "card"}</span><span>{formatCents(p.amountCents)}{p.refundedAmountCents ? ` (−${formatCents(p.refundedAmountCents)} refunded)` : ""}</span></div>
                  ))}
                </div>
              )}
              {hasBalanceDue(r.status) && money.outstandingCents > 0 && (
                <form action={sendPaymentReminder} className="mt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    <BellRing size={13} /> Send a payment reminder now
                  </button>
                </form>
              )}
            </Card>
          )}

          <Card>
            <CardTitle title="Timeline" />
            <div className="space-y-1.5 text-[12.5px]">
              {timeline.filter(([, d]) => d).map(([label, d]) => <Row key={label} l={label} v={when.format(d!)} />)}
            </div>
            {r.order && (
              <div className="mt-3 text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
                Order <Link href={`/dashboard/orders/${r.order.id}`} style={{ color: "var(--pine)" }} className="font-medium">#{r.order.id.slice(-6)}</Link> · {r.order.status.replace(/_/g, " ")} · {formatCents(r.order.totalCents)}
              </div>
            )}
          </Card>

          {(canDecline(r.status) || canRecordPayment(r.status)) && (
            <Card>
              <CardTitle title="Other outcomes" />
              {canRecordPayment(r.status) && (
                <form action={recordOfflinePayment} className="flex flex-wrap items-center gap-2 mb-3">
                  <input type="hidden" name="id" value={r.id} />
                  <select name="method" className="px-2.5 py-2 rounded-md border text-[12.5px]" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} defaultValue="e-transfer">
                    <option value="e-transfer">Paid by e-transfer</option>
                    <option value="cash">Paid in cash</option>
                    <option value="cheque">Paid by cheque</option>
                    <option value="invoice">Paid on invoice</option>
                  </select>
                  <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: "var(--ink)" }}>
                    $<input name="amount" type="number" min={0} step="0.01" defaultValue={centsToDollars(money.outstandingCents > 0 ? money.outstandingCents : totals.totalCents)} className="w-24 px-2 py-1.5 rounded-md border text-[12.5px]" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} />
                  </span>
                  <button type="submit" className="px-3 py-2 rounded-md text-[12.5px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                    Record payment
                  </button>
                  <span className="text-[11.5px] w-full" style={{ color: "var(--muted)" }}>
                    Blank or full amount settles it (customer gets the receipt). A smaller amount is a deposit: the event is confirmed and the rest stays outstanding.
                  </span>
                </form>
              )}
              {(r.status === "quoted" || r.status === "approved") && terms !== "on_approval" && (
                <form action={issueInvoice} className="flex flex-wrap items-center gap-2 mb-3">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    <FileText size={13} /> Approve on their behalf &amp; issue invoice ({TERMS_LABEL[terms]})
                  </button>
                  <span className="text-[11.5px] w-full" style={{ color: "var(--muted)" }}>They said yes by phone or email: confirms the event, numbers the invoice and emails it with the due date.</span>
                </form>
              )}
              {canDecline(r.status) && (
                <form action={declineRequest} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="reason" placeholder="Reason (optional, shown to the customer)" className="flex-1 min-w-[200px] px-3 py-2 rounded-md border text-[12.5px]" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} />
                  <button type="submit" className="px-3 py-2 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--clay)" }}>
                    Decline
                  </button>
                </form>
              )}
            </Card>
          )}
        </div>

        <Card>
          <CardTitle title={locked ? "Quote" : "Build the quote"} note={locked ? meta.hint : `Tax ${((settings?.taxRateBps ?? r.taxRateBps) / 100).toFixed(2)}% is added on top`} />
          {locked ? (
            <div>
              {options.length > 1 && (
                <p className="text-[12.5px] mb-2" style={{ color: "var(--ink-soft)" }}>
                  Proposal with {options.length} options{r.chosenOption !== null && r.chosenOption !== undefined ? ` — client chose option ${r.chosenOption + 1}: ${options[r.chosenOption]?.label ?? ""}` : " — client hasn't chosen yet; option 1 shown"}.
                </p>
              )}
              <div className="divide-y" style={{ borderColor: "var(--line)" }}>
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-[13.5px]">
                    <span style={{ color: "var(--ink)" }}>{l.name} <span style={{ color: "var(--muted)" }}>× {l.qty} @ {formatCents(l.unitPriceCents)}</span></span>
                    <span style={{ color: "var(--ink)" }}>{formatCents(l.qty * l.unitPriceCents)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-[13px]">
                <Row l="Subtotal" v={formatCents(totals.subtotalCents)} />
                {totals.discountCents > 0 && <Row l="Discount" v={`− ${formatCents(totals.discountCents)}`} />}
                {totals.deliveryFeeCents > 0 && <Row l="Delivery" v={formatCents(totals.deliveryFeeCents)} />}
                <Row l="Tax" v={formatCents(totals.taxCents)} />
                <div className="flex justify-between text-[16px] font-semibold pt-1" style={{ color: "var(--ink)" }}><span>Total</span><span>{formatCents(totals.totalCents)}</span></div>
              </div>
              {r.ownerNote && <p className="mt-3 text-[13px] whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>{r.ownerNote}</p>}
            </div>
          ) : (
            <QuoteEditor
              requestId={r.id}
              status={r.status}
              initialLines={lines}
              initialOptions={options}
              deliveryFeeCents={r.deliveryFeeCents}
              discountCents={r.discountCents}
              ownerNote={r.ownerNote ?? ""}
              taxRateBps={settings?.taxRateBps ?? r.taxRateBps}
              menu={menu}
              headcount={r.headcount}
              terms={terms}
              depositBps={settings?.cateringDepositBps ?? 0}
            />
          )}
        </Card>
      </div>
    </Page>
  );
}

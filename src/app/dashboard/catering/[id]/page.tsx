import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, CalendarDays, Users, ExternalLink } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Card, CardTitle, Row } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { CATERING_STATUS_META, formatEventDate, cateringCode, canQuote, canDecline, canRecordPayment, parseLines } from "@/lib/catering";
import { requestTotals } from "@/lib/catering-data";
import { QuoteEditor } from "./quote-editor";
import { declineRequest, recordOfflinePayment } from "../actions";

export const dynamic = "force-dynamic";

export default async function CateringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireOwner();
  const [r, settings, menu] = await Promise.all([
    db.cateringRequest.findFirst({ where: { id, businessId: business.id }, include: { order: { select: { id: true, status: true, totalCents: true } } } }),
    db.businessSettings.findUnique({ where: { businessId: business.id }, select: { timezone: true, taxRateBps: true, deliveryFeeCents: true } }),
    db.meal.findMany({ where: { businessId: business.id, active: true }, orderBy: [{ isAddOn: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, priceCents: true } }),
  ]);
  if (!r) notFound();
  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  const meta = CATERING_STATUS_META[r.status];
  const { totals } = requestTotals(r);
  const lines = parseLines(r.items);
  const locked = !canQuote(r.status);
  const quoteUrl = `/store/${business.slug}/catering/${r.token}`;

  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
  const timeline: [string, Date | null][] = [
    ["Requested", r.createdAt],
    ["Quote sent", r.quotedAt],
    ["Approved", r.approvedAt],
    ["Paid", r.paidAt],
    ["Declined", r.declinedAt],
  ];

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
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ color: meta.fg, background: meta.bg }} title={meta.hint}>{meta.label}</span>
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
              <div className="flex items-center gap-2"><CalendarDays size={14} style={{ color: "var(--muted)" }} /> {formatEventDate(r.eventDate, tz)}{r.eventTime ? ` at ${r.eventTime}` : ""}</div>
              {r.headcount ? <div className="flex items-center gap-2"><Users size={14} style={{ color: "var(--muted)" }} /> {r.headcount} people</div> : null}
              <div className="flex items-center gap-2"><MapPin size={14} style={{ color: "var(--muted)" }} /> {r.fulfillment === "pickup" ? "Pickup" : r.address ?? "Delivery"}</div>
              <div className="flex items-center gap-2"><Mail size={14} style={{ color: "var(--muted)" }} /> <a href={`mailto:${r.email}`} style={{ color: "var(--pine)" }}>{r.email}</a></div>
              {r.phone ? <div className="flex items-center gap-2"><Phone size={14} style={{ color: "var(--muted)" }} /> <a href={`tel:${r.phone}`} style={{ color: "var(--pine)" }}>{r.phone}</a></div> : null}
            </div>
            {r.notes && (
              <div className="mt-3 rounded-lg px-3.5 py-3 text-[13px] whitespace-pre-wrap" style={{ background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink)" }}>{r.notes}</div>
            )}
          </Card>

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
                  <button type="submit" className="px-3 py-2 rounded-md text-[12.5px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                    Record payment · {formatCents(totals.totalCents)}
                  </button>
                  <span className="text-[11.5px] w-full" style={{ color: "var(--muted)" }}>Confirms the event and creates the paid order (customer gets the receipt). Use when they paid outside the card checkout.</span>
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
              deliveryFeeCents={r.deliveryFeeCents}
              discountCents={r.discountCents}
              ownerNote={r.ownerNote ?? ""}
              taxRateBps={settings?.taxRateBps ?? r.taxRateBps}
              menu={menu}
            />
          )}
        </Card>
      </div>
    </Page>
  );
}

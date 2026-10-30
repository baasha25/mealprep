import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontBusiness } from "@/lib/storefront";
import { loadRequestByToken, requestTotals, moneyState } from "@/lib/catering-data";
import { cateringCode, formatEventDate } from "@/lib/catering";
import { TERMS_LABEL, toTerms, daysUntil } from "@/lib/catering-terms";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { formatCents } from "@/lib/money";
import { cldLogo } from "@/lib/cloudinary";
import { PayBalanceButton } from "../pay-balance-button";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * The invoice a corporate client receives when a quote is approved on net
 * terms. Printable (File → Print or the button) and payable by card. The
 * token is the capability; no login.
 */
export default async function CateringInvoicePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business?.settings) notFound();
  const r = await loadRequestByToken(business.id, token);
  if (!r || !r.invoiceNumber) notFound();
  const tz = business.settings.timezone || DEFAULT_TIMEZONE;
  const { lines, totals } = requestTotals(r);
  const money = moneyState(r);
  const terms = toTerms(r.invoiceTerms);
  const issued = r.invoiceSentAt ?? r.approvedAt ?? r.createdAt;
  const due = r.invoiceDueAt;
  const overdue = due ? daysUntil(due) < 0 && money.outstandingCents > 0 : false;
  const settled = money.outstandingCents <= 0;
  const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "long" });
  const logo = business.logoUrl ? (cldLogo(business.logoUrl, { h: 48 }) ?? business.logoUrl) : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business.brandColor } as React.CSSProperties}>
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } .sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print max-w-3xl mx-auto px-6 pt-6 flex items-center justify-between gap-3">
        <Link href={`/store/${slug}/catering/${token}`} className="text-[13px] font-medium" style={{ color: "var(--pine)" }}>← Your event page</Link>
        <PrintButton label="Print / save as PDF" />
      </div>

      <main className="sheet max-w-3xl mx-auto my-6 rounded-2xl border p-8 sm:p-10" style={{ background: "#fff", borderColor: "var(--line)", boxShadow: "0 1px 2px rgba(31,30,26,.04)" }}>
        <header className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" className="h-12 w-auto" /> : <div className="w-10 h-10 rounded-md" style={{ background: "var(--pine)" }} />}
            <div>
              <div className="disp text-[22px] font-medium leading-tight" style={{ color: "var(--ink)" }}>{business.name}</div>
              {business.settings.serviceArea && <div className="text-[12px]" style={{ color: "var(--muted)" }}>{business.settings.serviceArea}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Invoice</div>
            <div className="disp text-[26px] font-medium leading-tight" style={{ color: "var(--ink)" }}>{r.invoiceNumber}</div>
            <div className="mt-1 inline-block text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={settled ? { color: "#2f5e3f", background: "#d9ead9" } : overdue ? { color: "#9a5142", background: "#f0ddd6" } : { color: "#3f5c5a", background: "#d6e4e3" }}>
              {settled ? "Paid" : overdue ? "Overdue" : "Awaiting payment"}
            </div>
          </div>
        </header>

        <section className="grid sm:grid-cols-3 gap-5 mt-8 text-[13px]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Bill to</div>
            <div className="font-medium" style={{ color: "var(--ink)" }}>{r.company || r.name}</div>
            {r.company && <div style={{ color: "var(--ink-soft)" }}>{r.name}</div>}
            <div style={{ color: "var(--ink-soft)" }}>{r.email}</div>
            {r.phone && <div style={{ color: "var(--ink-soft)" }}>{r.phone}</div>}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Event</div>
            <div className="font-medium" style={{ color: "var(--ink)" }}>{formatEventDate(r.eventDate, tz)}{r.eventTime ? ` · ${r.eventTime}` : ""}</div>
            <div style={{ color: "var(--ink-soft)" }}>{r.fulfillment === "pickup" ? "Pickup" : r.address ?? "Delivery"}</div>
            {r.headcount ? <div style={{ color: "var(--ink-soft)" }}>{r.headcount} guests</div> : null}
            <div style={{ color: "var(--muted)" }}>Ref #{cateringCode(r.id)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Terms</div>
            <div className="font-medium" style={{ color: "var(--ink)" }}>{TERMS_LABEL[terms]}</div>
            <div style={{ color: "var(--ink-soft)" }}>Issued {dateFmt.format(issued)}</div>
            {due && <div style={{ color: overdue ? "var(--clay)" : "var(--ink-soft)" }}>Due {dateFmt.format(due)}</div>}
          </div>
        </section>

        <table className="w-full mt-8 text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="text-left font-semibold pb-2" style={{ borderBottom: "1px solid var(--line)" }}>Item</th>
              <th className="text-right font-semibold pb-2 w-16" style={{ borderBottom: "1px solid var(--line)" }}>Qty</th>
              <th className="text-right font-semibold pb-2 w-24" style={{ borderBottom: "1px solid var(--line)" }}>Unit</th>
              <th className="text-right font-semibold pb-2 w-28" style={{ borderBottom: "1px solid var(--line)" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                <td className="py-2" style={{ color: "var(--ink)" }}>{l.name}</td>
                <td className="py-2 text-right" style={{ color: "var(--ink-soft)" }}>{l.qty}</td>
                <td className="py-2 text-right" style={{ color: "var(--ink-soft)" }}>{formatCents(l.unitPriceCents)}</td>
                <td className="py-2 text-right" style={{ color: "var(--ink)" }}>{formatCents(l.qty * l.unitPriceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-full sm:w-72 space-y-1 text-[13px]" style={{ color: "var(--ink-soft)" }}>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCents(totals.subtotalCents)}</span></div>
            {totals.discountCents > 0 && <div className="flex justify-between"><span>Discount</span><span>− {formatCents(totals.discountCents)}</span></div>}
            {totals.deliveryFeeCents > 0 && <div className="flex justify-between"><span>Delivery / set-up</span><span>{formatCents(totals.deliveryFeeCents)}</span></div>}
            <div className="flex justify-between"><span>Tax ({(r.taxRateBps / 100).toFixed(2)}%)</span><span>{formatCents(totals.taxCents)}</span></div>
            <div className="flex justify-between text-[16px] font-semibold pt-1.5" style={{ color: "var(--ink)", borderTop: "1px solid var(--line)" }}><span>Total</span><span>{formatCents(totals.totalCents)}</span></div>
            {money.paidCents > 0 && <div className="flex justify-between"><span>Paid</span><span>− {formatCents(money.paidCents)}</span></div>}
            <div className="flex justify-between text-[15px] font-semibold" style={{ color: settled ? "#2f5e3f" : "var(--ink)" }}><span>{settled ? "Balance" : "Amount due"}</span><span>{formatCents(money.outstandingCents)}</span></div>
          </div>
        </div>

        {r.ownerNote && <p className="mt-6 text-[13px] whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>{r.ownerNote}</p>}

        <footer className="mt-8 pt-5 text-[12.5px]" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-soft)" }}>
          {!settled && (
            <div className="no-print mb-4">
              <PayBalanceButton slug={slug} token={token} amountCents={money.outstandingCents} label={`Pay ${formatCents(money.outstandingCents)} by card`} />
            </div>
          )}
          <p>Pay by card using the button above, or by e-transfer or cheque to {business.name}, quoting {r.invoiceNumber}. Questions about this invoice: reply to the email it came with.</p>
        </footer>
      </main>
    </div>
  );
}

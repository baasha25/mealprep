import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, XCircle, FileText } from "lucide-react";
import { getStorefrontBusiness } from "@/lib/storefront";
import { loadRequestByToken, requestTotals, moneyState } from "@/lib/catering-data";
import { CATERING_STATUS_META, cateringCode, formatEventDate, canApprove, hasBalanceDue } from "@/lib/catering";
import { parseOptions, paymentPlan, toTerms, TERMS_LABEL, balanceDueAt, daysUntil } from "@/lib/catering-terms";
import { quoteTotals } from "@/lib/catering";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { formatCents } from "@/lib/money";
import { StoreHeader } from "../../store-header";
import { ApproveButton } from "./approve-button";
import { PayBalanceButton } from "./pay-balance-button";
import { ChooseOption } from "./choose-option";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;

/** The customer's view of one catering request: status, the quote (or options) to approve, and what is still owed. */
export default async function CateringQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { slug, token } = await params;
  const { canceled } = await searchParams;
  const business = await getStorefrontBusiness(slug);
  if (!business?.settings) notFound();
  const r = await loadRequestByToken(business.id, token);
  if (!r) notFound();
  const s = business.settings;
  const tz = s.timezone || DEFAULT_TIMEZONE;
  const { lines, totals } = requestTotals(r);
  const money = moneyState(r);
  const meta = CATERING_STATUS_META[r.status];
  const code = cateringCode(r.id);
  const when = `${formatEventDate(r.eventDate, tz)}${r.eventTime ? ` · ${r.eventTime}` : ""}`;
  const options = parseOptions(r.options);
  const needsChoice = r.status === "quoted" && options.length > 1 && (r.chosenOption === null || r.chosenOption === undefined);
  const terms = toTerms(r.invoiceTerms ?? s.cateringTerms);
  const plan = paymentPlan(totals.totalCents, r.depositBps, terms);
  const balanceDate = r.balanceDueAt ?? balanceDueAt(r.eventDate, s.cateringBalanceDays);

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business.brandColor } as React.CSSProperties}>
      <StoreHeader slug={slug} name={business.name} logoUrl={business.logoUrl} tagline={s.storeTagline} />
      <main className="max-w-3xl mx-auto px-6 py-8 fade">
        <Link href={`/store/${slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium mb-5" style={{ color: "var(--pine)" }}>
          <ArrowLeft size={14} /> Back to the menu
        </Link>
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="disp text-[28px] leading-none font-medium" style={{ color: "var(--ink)" }}>
            Catering request #{code}
          </h1>
          <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
        </div>
        <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
          {when} · {r.fulfillment === "pickup" ? "Pickup" : `Delivery to ${r.address ?? "your address"}`}{r.headcount ? ` · ${r.headcount} people` : ""}
        </p>

        {canceled && r.status !== "paid" && (
          <p className="mt-4 rounded-lg px-4 py-3 text-[13px]" style={{ background: "#f3e9c9", color: "#8a6d1f" }}>
            Payment wasn&apos;t completed. Your quote is still here whenever you&apos;re ready.
          </p>
        )}

        {/* Status explainer */}
        <section className="rounded-xl border p-5 mt-6" style={card}>
          {r.status === "requested" && (
            <div className="flex items-start gap-3">
              <Clock size={18} style={{ color: "var(--pine)" }} className="mt-0.5" />
              <div>
                <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{business.name} is pricing your request</div>
                <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>You&apos;ll get an email when the quote is ready. Nothing is charged until you approve it. Questions? Reply to the confirmation email.</p>
              </div>
            </div>
          )}
          {r.status === "declined" && (
            <div className="flex items-start gap-3">
              <XCircle size={18} style={{ color: "var(--clay)" }} className="mt-0.5" />
              <div>
                <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>The kitchen couldn&apos;t take this one</div>
                <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>{r.declineReason || "Thanks for asking — the regular menu is always open for smaller orders."}</p>
              </div>
            </div>
          )}
          {r.status === "paid" && (
            <div className="flex items-start gap-3">
              <Check size={18} style={{ color: "var(--pine)" }} className="mt-0.5" />
              <div>
                <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Confirmed — see you {formatEventDate(r.eventDate, tz)}</div>
                <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>Paid in full. {business.name} has it on the production schedule{r.order ? ` (order #${r.order.id.slice(-6)})` : ""}.{r.invoiceNumber ? ` Invoice ${r.invoiceNumber} is settled.` : ""}</p>
              </div>
            </div>
          )}
          {r.status === "deposit_paid" && (
            <div className="flex items-start gap-3">
              <Check size={18} style={{ color: "var(--pine)" }} className="mt-0.5" />
              <div>
                <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Deposit received — your date is confirmed</div>
                <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>
                  {business.name} has {formatCents(money.paidCents)} and your event is on the production schedule. The remaining <strong style={{ color: "var(--ink)" }}>{formatCents(money.outstandingCents)}</strong> is {daysUntil(balanceDate) <= 0 ? "due now" : `due ${formatEventDate(balanceDate, tz)}`}{daysUntil(balanceDate) < 0 ? " (overdue)" : ""}. Pay it by card below, or by e-transfer to {business.name}.
                </p>
                <div className="mt-4"><PayBalanceButton slug={slug} token={token} amountCents={money.outstandingCents} label={`Pay the balance · ${formatCents(money.outstandingCents)}`} /></div>
              </div>
            </div>
          )}
          {r.status === "invoiced" && (
            <div className="flex items-start gap-3">
              <FileText size={18} style={{ color: "var(--pine)" }} className="mt-0.5" />
              <div>
                <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Confirmed — invoice {r.invoiceNumber} {money.outstandingCents > 0 ? "awaiting payment" : "settled"}</div>
                <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>
                  Your event is on the production schedule. {TERMS_LABEL[terms]}{r.invoiceDueAt ? `, due ${formatEventDate(r.invoiceDueAt, tz)}${daysUntil(r.invoiceDueAt) < 0 ? " (overdue)" : ""}` : ""}. Outstanding: <strong style={{ color: "var(--ink)" }}>{formatCents(money.outstandingCents)}</strong>.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PayBalanceButton slug={slug} token={token} amountCents={money.outstandingCents} label={`Pay ${formatCents(money.outstandingCents)} by card`} />
                  <Link href={`/store/${slug}/catering/${token}/invoice`} className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--pine)" }}><FileText size={14} /> View / print the invoice</Link>
                </div>
              </div>
            </div>
          )}
          {(r.status === "quoted" || r.status === "approved") && (
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                {r.status === "approved" ? "Approved — finish payment to lock in the date" : needsChoice ? "Your proposal is ready — pick an option" : "Your quote is ready"}
              </div>
              {!needsChoice && (
                <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>
                  {plan.mode === "invoice"
                    ? `Approve and ${business.name} confirms your date and emails you an invoice on ${TERMS_LABEL[terms]} terms. No card needed now.`
                    : plan.mode === "card_deposit"
                      ? `Approve and pay a ${formatCents(plan.dueNowCents)} deposit to lock in your date. The remaining ${formatCents(plan.laterCents)} is ${daysUntil(balanceDueAt(r.eventDate, s.cateringBalanceDays)) <= 0 ? "due before the event" : `due ${formatEventDate(balanceDueAt(r.eventDate, s.cateringBalanceDays), tz)}`}.`
                      : "Approve and pay by card to lock in your date."}
                </p>
              )}
              {r.ownerNote && !needsChoice && (
                <p className="text-[13.5px] mt-2 whitespace-pre-wrap rounded-lg px-3.5 py-3" style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}>{r.ownerNote}</p>
              )}
            </div>
          )}
        </section>

        {/* Options to choose from */}
        {needsChoice && (
          <section className="rounded-xl border p-5 mt-4" style={card}>
            <h2 className="text-[14px] font-semibold mb-1" style={{ color: "var(--ink)" }}>Choose one</h2>
            <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>{business.name} put together {options.length} ways to do this. Pick the one you like; you approve and pay after.</p>
            <ChooseOption
              slug={slug}
              token={token}
              options={options.map((o, i) => ({
                index: i,
                label: o.label,
                note: o.ownerNote,
                lines: o.items.map((l) => ({ name: l.name, qty: l.qty, lineCents: l.qty * l.unitPriceCents })),
                totalCents: quoteTotals(o.items, { deliveryFeeCents: o.deliveryFeeCents, discountCents: o.discountCents, taxRateBps: r.taxRateBps }).totalCents,
              }))}
            />
          </section>
        )}

        {/* The quote (or the request, pre-quote) */}
        {lines.length > 0 && !needsChoice && (
          <section className="rounded-xl border p-5 mt-4" style={card}>
            <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              {r.status === "requested" ? "What you asked for" : options.length > 1 && r.chosenOption !== null && r.chosenOption !== undefined ? `Quote · ${options[r.chosenOption]?.label ?? "your option"}` : "Quote"}
            </h2>
            <div className="divide-y" style={{ borderColor: "var(--line)" }}>
              {lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-[13.5px]">
                  <span style={{ color: "var(--ink)" }}>{l.name} <span style={{ color: "var(--muted)" }}>× {l.qty}</span></span>
                  {r.status !== "requested" && <span style={{ color: "var(--ink)" }}>{formatCents(l.qty * l.unitPriceCents)}</span>}
                </div>
              ))}
            </div>
            {r.status !== "requested" && (
              <div className="mt-3 space-y-1 text-[13px]" style={{ color: "var(--muted)" }}>
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCents(totals.subtotalCents)}</span></div>
                {totals.discountCents > 0 && <div className="flex justify-between"><span>Discount</span><span>− {formatCents(totals.discountCents)}</span></div>}
                {totals.deliveryFeeCents > 0 && <div className="flex justify-between"><span>Delivery</span><span>{formatCents(totals.deliveryFeeCents)}</span></div>}
                {totals.taxCents > 0 && <div className="flex justify-between"><span>Tax</span><span>{formatCents(totals.taxCents)}</span></div>}
                <div className="flex justify-between text-[16px] font-semibold pt-1" style={{ color: "var(--ink)" }}><span>Total</span><span>{formatCents(totals.totalCents)}</span></div>
                {hasBalanceDue(r.status) && <div className="flex justify-between"><span>Paid so far</span><span>{formatCents(money.paidCents)}</span></div>}
              </div>
            )}
            {canApprove(r.status) && (
              <ApproveButton
                slug={slug}
                token={token}
                amountCents={plan.mode === "invoice" ? 0 : plan.dueNowCents}
                mode={plan.mode}
                approved={r.status === "approved"}
                totalCents={totals.totalCents}
              />
            )}
          </section>
        )}
        {r.notes && (
          <section className="rounded-xl border p-5 mt-4" style={card}>
            <h2 className="text-[14px] font-semibold mb-2" style={{ color: "var(--ink)" }}>Your notes</h2>
            <p className="text-[13.5px] whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>{r.notes}</p>
          </section>
        )}
      </main>
    </div>
  );
}

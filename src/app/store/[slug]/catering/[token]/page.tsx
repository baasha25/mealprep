import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, XCircle } from "lucide-react";
import { getStorefrontBusiness } from "@/lib/storefront";
import { loadRequestByToken, requestTotals } from "@/lib/catering-data";
import { CATERING_STATUS_META, cateringCode, formatEventDate, canApprove } from "@/lib/catering";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { formatCents } from "@/lib/money";
import { StoreHeader } from "../../store-header";
import { ApproveButton } from "./approve-button";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;

/** The customer's view of one catering request: status, and the quote to approve. */
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
  const tz = business.settings.timezone || DEFAULT_TIMEZONE;
  const { lines, totals } = requestTotals(r);
  const meta = CATERING_STATUS_META[r.status];
  const code = cateringCode(r.id);
  const when = `${formatEventDate(r.eventDate, tz)}${r.eventTime ? ` · ${r.eventTime}` : ""}`;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business.brandColor } as React.CSSProperties}>
      <StoreHeader slug={slug} name={business.name} logoUrl={business.logoUrl} tagline={business.settings.storeTagline} />
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
                <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>Paid in full. {business.name} has it on the production schedule{r.order ? ` (order #${r.order.id.slice(-6)})` : ""}.</p>
              </div>
            </div>
          )}
          {(r.status === "quoted" || r.status === "approved") && (
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                {r.status === "approved" ? "Approved — finish payment to lock in the date" : "Your quote is ready"}
              </div>
              {r.ownerNote && (
                <p className="text-[13.5px] mt-2 whitespace-pre-wrap rounded-lg px-3.5 py-3" style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}>{r.ownerNote}</p>
              )}
            </div>
          )}
        </section>

        {/* The quote (or the request, pre-quote) */}
        {lines.length > 0 && (
          <section className="rounded-xl border p-5 mt-4" style={card}>
            <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--ink)" }}>{r.status === "requested" ? "What you asked for" : "Quote"}</h2>
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
              </div>
            )}
            {canApprove(r.status) && <ApproveButton slug={slug} token={token} totalCents={totals.totalCents} approved={r.status === "approved"} />}
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

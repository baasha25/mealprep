import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { cateringCode, formatEventDate, CATERING_STATUS_META } from "@/lib/catering";
import { parseDietary, DIETARY_KEYS, DIETARY_LABEL } from "@/lib/catering-terms";
import { requestTotals, moneyState } from "@/lib/catering-data";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

/**
 * The event sheet: one printable page the kitchen takes to the event or pins
 * by the pass. Client and contact, when and where, headcount and dietary
 * counts, every line with a packing checkbox, notes. Staff can see it too.
 */
export default async function EventSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, role } = await requireBusiness();
  const [r, settings] = await Promise.all([
    db.cateringRequest.findFirst({ where: { id, businessId: business.id }, include: { order: { select: { id: true, payments: { select: { amountCents: true, status: true, refundedAmountCents: true } } } } } }),
    db.businessSettings.findUnique({ where: { businessId: business.id }, select: { timezone: true } }),
  ]);
  if (!r) notFound();
  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  const { lines, totals } = requestTotals(r);
  const money = moneyState(r);
  const dietary = parseDietary(r.dietary);
  const meta = CATERING_STATUS_META[r.status];
  const isOwner = role === "owner";

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } .sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important } }`}</style>
      <div className="no-print max-w-3xl mx-auto px-6 pt-6 flex items-center justify-between gap-3">
        <Link href={`/dashboard/catering/${r.id}`} className="text-[13px] font-medium" style={{ color: "var(--pine)" }}>← Request #{cateringCode(r.id)}</Link>
        <PrintButton label="Print event sheet" />
      </div>

      <main className="sheet max-w-3xl mx-auto my-6 rounded-2xl border p-8" style={{ background: "#fff", borderColor: "var(--line)" }}>
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Event sheet · {business.name}</div>
            <h1 className="disp text-[26px] font-medium leading-tight mt-1" style={{ color: "var(--ink)" }}>{r.company || r.name}</h1>
            <div className="text-[14px] mt-1" style={{ color: "var(--ink)" }}>
              <strong>{formatEventDate(r.eventDate, tz)}</strong>{r.eventTime ? ` · ${r.eventTime}` : ""}{r.deliveryWindow ? ` · window ${r.deliveryWindow}` : ""}
            </div>
          </div>
          <div className="text-right text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
            <div>#{cateringCode(r.id)}{r.invoiceNumber ? ` · ${r.invoiceNumber}` : ""}</div>
            <div className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</div>
            {isOwner && money.outstandingCents > 0 && <div className="mt-1" style={{ color: "var(--clay)" }}>Balance due {formatCents(money.outstandingCents)}</div>}
          </div>
        </header>

        <section className="grid sm:grid-cols-2 gap-5 mt-6 text-[13.5px]">
          <div className="rounded-lg p-3.5" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>{r.fulfillment === "pickup" ? "Pickup" : "Deliver to"}</div>
            <div className="font-medium" style={{ color: "var(--ink)" }}>{r.fulfillment === "pickup" ? "Client collects from the kitchen" : r.address ?? "Address to confirm"}</div>
            <div className="mt-2" style={{ color: "var(--ink-soft)" }}>On site: <strong style={{ color: "var(--ink)" }}>{r.name}</strong>{r.phone ? ` · ${r.phone}` : ""}</div>
            <div style={{ color: "var(--ink-soft)" }}>{r.email}</div>
          </div>
          <div className="rounded-lg p-3.5" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>Headcount &amp; dietary</div>
            <div className="disp text-[24px] font-medium leading-none" style={{ color: "var(--ink)" }}>{r.headcount ?? totals.mealCount}<span className="text-[13px] font-normal ml-1.5" style={{ color: "var(--muted)" }}>{r.headcount ? "guests" : "portions"}</span></div>
            {DIETARY_KEYS.some((k) => dietary[k]) ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {DIETARY_KEYS.filter((k) => dietary[k]).map((k) => (
                  <li key={k} className="text-[12px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#f3e9c9", color: "#8a6d1f" }}>{dietary[k]} {DIETARY_LABEL[k].toLowerCase()}</li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-[12.5px]" style={{ color: "var(--muted)" }}>No dietary counts given — check the notes.</div>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Pack list</div>
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                <th className="w-8 pb-1.5" style={{ borderBottom: "1px solid var(--line)" }} />
                <th className="text-left font-semibold pb-1.5" style={{ borderBottom: "1px solid var(--line)" }}>Item</th>
                <th className="text-right font-semibold pb-1.5 w-16" style={{ borderBottom: "1px solid var(--line)" }}>Qty</th>
                <th className="text-left font-semibold pb-1.5 pl-4 w-40" style={{ borderBottom: "1px solid var(--line)" }}>Packed / notes</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="py-2.5"><span className="inline-block w-4 h-4 rounded border align-middle" style={{ borderColor: "var(--ink)" }} /></td>
                  <td className="py-2.5" style={{ color: "var(--ink)" }}>{l.name}</td>
                  <td className="py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>{l.qty}</td>
                  <td className="py-2.5 pl-4" style={{ borderLeft: "1px dashed var(--line)" }} />
                </tr>
              ))}
              {["Labels / allergen cards", "Serving utensils, napkins, plates", "Set-up: tables, chafers, ice", "Invoice / delivery note in the box"].map((x) => (
                <tr key={x} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td className="py-2"><span className="inline-block w-4 h-4 rounded border align-middle" style={{ borderColor: "var(--muted)" }} /></td>
                  <td className="py-2" style={{ color: "var(--ink-soft)" }}>{x}</td>
                  <td /><td className="pl-4" style={{ borderLeft: "1px dashed var(--line)" }} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {(r.notes || r.ownerNote) && (
          <section className="grid sm:grid-cols-2 gap-5 mt-6 text-[13px]">
            {r.notes && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Client asked for</div>
                <p className="whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{r.notes}</p>
              </div>
            )}
            {r.ownerNote && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>We promised</div>
                <p className="whitespace-pre-wrap" style={{ color: "var(--ink)" }}>{r.ownerNote}</p>
              </div>
            )}
          </section>
        )}

        <footer className="mt-8 pt-4 flex flex-wrap gap-x-6 gap-y-1 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
          <span>Left kitchen at: ________</span>
          <span>Driver: ____________</span>
          <span>Delivered at: ________</span>
          <span>Received by: ____________</span>
        </footer>
      </main>
    </div>
  );
}

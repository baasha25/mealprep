import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaf, Check, Clock, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { formatCents } from "@/lib/money";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { ETRANSFER, isAwaitingEtransfer, etransferAmountCents, etransferReference, etransferDeadline } from "@/lib/etransfer";
import { expireEtransferOrders } from "@/lib/etransfer-data";
import { CopyValue } from "@/components/copy-value";

export const dynamic = "force-dynamic";
// Personal pages: never in search results.
export const metadata = { title: "Pay by e-transfer", robots: { index: false, follow: false } };

/**
 * Pay by e-transfer: what to send, where, what to write in the message, and by
 * when. The customer lands here after placing the order and can come back from
 * the email; once the kitchen marks the money received it reads "confirmed".
 */
export default async function EtransferPayPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const business = await getStorefrontBusiness(slug);
  if (!business) notFound();
  // Release anything past its hold window first, so this page never asks for
  // money on an order that is already gone.
  await expireEtransferOrders({ businessId: business.id });
  const order = await db.order.findFirst({
    where: { id, businessId: business.id, paymentMethod: ETRANSFER },
    select: {
      id: true, status: true, paymentMethod: true, createdAt: true, totalCents: true, giftRedeemedCents: true, fulfillment: true, deliveryDate: true,
      customer: { select: { name: true } },
      items: { select: { id: true, qty: true, nameSnapshot: true } },
    },
  });
  if (!order) notFound();

  const s = business.settings;
  const tz = s?.timezone || DEFAULT_TIMEZONE;
  const awaiting = isAwaitingEtransfer(order);
  const gone = order.status === "canceled" || order.status === "refunded";
  const amount = formatCents(etransferAmountCents(order));
  const code = etransferReference(order.id);
  const deadline = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(etransferDeadline(order.createdAt, s?.etransferHoldHours));
  const firstName = order.customer?.name?.split(" ")[0] ?? "";
  const when = order.deliveryDate ? new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(order.deliveryDate) : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business.brandColor ?? "#2f4536" } as React.CSSProperties}>
      <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-2.5">
          <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
            <Leaf size={17} color="#f4f2ec" />
          </div>
          <div className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>{business.name}</div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-14 text-center fade">
        {awaiting ? (
          <>
            <div className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5" style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}>
              <Clock size={25} style={{ color: "var(--pine)" }} />
            </div>
            <h1 className="disp text-[27px] font-medium" style={{ color: "var(--ink)" }}>One step left{firstName ? `, ${firstName}` : ""}</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
              Your order is held. Send an Interac e-Transfer with these details and {business.name} will confirm it as soon as it arrives.
            </p>

            <div className="mt-6 rounded-xl border px-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <CopyValue label="Amount" value={amount} copy={amount.replace(/[^0-9.]/g, "")} />
              <CopyValue label="Send to" value={s?.etransferEmail ?? ""} />
              <CopyValue label="Message" value={code} />
              <div className="py-3 text-left text-[12.5px]" style={{ color: "var(--muted)" }}>
                Put <strong style={{ color: "var(--ink)" }}>{code}</strong> in the message so your payment is matched to this order.
                {s?.etransferNote ? <span className="block mt-1.5" style={{ color: "var(--ink-soft)" }}>{s.etransferNote}</span> : null}
              </div>
            </div>

            <p className="text-[13px] mt-4" style={{ color: "var(--ink-soft)" }}>
              Held until <strong style={{ color: "var(--ink)" }}>{deadline}</strong>. After that the order is released.
            </p>
          </>
        ) : gone ? (
          <>
            <div className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5" style={{ background: "color-mix(in srgb, var(--clay) 12%, transparent)" }}>
              <XCircle size={25} style={{ color: "var(--clay)" }} />
            </div>
            <h1 className="disp text-[25px] font-medium" style={{ color: "var(--ink)" }}>This order was released</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
              Order #{code} is no longer held, so please don&apos;t send payment for it. You can place it again any time. If you already sent the money, contact {business.name} and they&apos;ll sort it out.
            </p>
          </>
        ) : (
          <>
            <div className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5" style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}>
              <Check size={26} style={{ color: "var(--pine)" }} />
            </div>
            <h1 className="disp text-[27px] font-medium" style={{ color: "var(--ink)" }}>Payment received</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
              Thanks{firstName ? `, ${firstName}` : ""}! {business.name} has your e-transfer of {amount} and order #{code} is confirmed.
              {when ? ` It's set for ${order.fulfillment === "pickup" ? "pickup" : "delivery"} on ${when}.` : ""}
            </p>
          </>
        )}

        <div className="mt-6 rounded-xl border p-4 text-left" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
            Order #{code}{when ? ` · ${order.fulfillment === "pickup" ? "Pickup" : "Delivery"} ${when}` : ""}
          </div>
          <ul className="space-y-1">
            {order.items.map((it) => (
              <li key={it.id} className="text-[13.5px]" style={{ color: "var(--ink)" }}>{it.qty}× {it.nameSnapshot}</li>
            ))}
          </ul>
        </div>

        <Link href={`/store/${slug}`} className="inline-block mt-7 px-5 py-2.5 rounded-lg text-[14px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
          Back to the store
        </Link>
      </main>
    </div>
  );
}

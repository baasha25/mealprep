import Link from "next/link";
import { Leaf, Check, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { getStorefrontBusiness } from "@/lib/storefront";
import { sendOrderConfirmation, sendOwnerNewOrder } from "@/lib/email";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";
// Personal pages: never in search results.
export const metadata = { robots: { index: false, follow: false } };

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;
  const business = await getStorefrontBusiness(slug);

  let paid = false;
  let amountCents = 0;
  let code = "";
  let whenLabel = "You\u2019ll get your meals on the next delivery.";

  if (STRIPE_ENABLED && session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const orderId = session.metadata?.orderId;
      amountCents = session.amount_total ?? 0;
      if (session.payment_status === "paid" && orderId) {
        const order = await db.order.findFirst({ where: { id: orderId }, select: { id: true, status: true, type: true, deliveryDate: true } });
        if (order) {
          code = order.id.slice(-6);
          paid = true;
          // Mark paid + record the payment (idempotent) and send the receipt
          // once, only on the first transition to paid.
          if (order.status !== "paid") {
            const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
            await db.$transaction([
              db.order.update({ where: { id: order.id }, data: { status: "paid", stripePaymentIntentId: paymentIntentId } }),
              db.payment.create({
                data: { orderId: order.id, stripePaymentIntentId: paymentIntentId, amountCents, status: "succeeded" },
              }),
            ]);
            // A catering order: the request behind it is now paid/confirmed.
            if (order.type === "catering") {
              await db.cateringRequest.updateMany({ where: { orderId: order.id }, data: { status: "paid", paidAt: new Date() } });
            }
            await sendOrderConfirmation(order.id);
            await sendOwnerNewOrder(order.id);
          }
          if (order.type === "catering" && order.deliveryDate) {
            whenLabel = `Your catering order is confirmed for ${new Intl.DateTimeFormat("en-US", { timeZone: business?.settings?.timezone || "America/Toronto", weekday: "long", month: "long", day: "numeric" }).format(order.deliveryDate)}.`;
          }
        }
      }
    } catch {
      paid = false;
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", "--pine": business?.brandColor ?? "#2f4536" } as React.CSSProperties}>
      <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-2.5">
          <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
            <Leaf size={17} color="#f4f2ec" />
          </div>
          <div className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>{business?.name ?? "PrepFlow"}</div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-20 text-center fade">
        {paid ? (
          <>
            <div className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5" style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}>
              <Check size={26} style={{ color: "var(--pine)" }} />
            </div>
            <h1 className="disp text-[28px] font-medium" style={{ color: "var(--ink)" }}>Payment received</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
              Thanks! We&apos;ve charged {formatCents(amountCents)} and your order{code ? ` #${code}` : ""} is confirmed. {whenLabel}
            </p>
          </>
        ) : (
          <>
            <div className="grid place-items-center w-14 h-14 rounded-full mx-auto mb-5" style={{ background: "color-mix(in srgb, var(--clay) 12%, transparent)" }}>
              <AlertTriangle size={24} style={{ color: "var(--clay)" }} />
            </div>
            <h1 className="disp text-[24px] font-medium" style={{ color: "var(--ink)" }}>Payment not confirmed</h1>
            <p className="text-[14px] mt-2" style={{ color: "var(--ink-soft)" }}>
              We couldn&apos;t confirm this payment. If you were charged, contact the kitchen — otherwise please try again.
            </p>
          </>
        )}
        <Link href={`/store/${slug}`} className="inline-block mt-7 px-5 py-2.5 rounded-lg text-[14px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
          Back to the store
        </Link>
      </main>
    </div>
  );
}

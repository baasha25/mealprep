import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Mail, Phone } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Card, CardTitle, Row } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { StatusControl } from "../status-control";
import { updateOrderStatus } from "../actions";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const order = await db.order.findFirst({
    where: { id, businessId: business.id },
    include: {
      customer: true,
      items: true,
    },
  });
  if (!order) notFound();

  const discountsCents =
    order.subtotalCents + order.taxCents + order.feesCents - order.totalCents;

  return (
    <Page>
      <Link
        href="/dashboard/orders"
        className="inline-flex items-center gap-1.5 text-[12.5px] mb-4"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft size={14} /> All orders
      </Link>
      <Head
        kicker={ORDER_TYPE_LABEL[order.type] ?? order.type}
        title={`Order #${order.id.slice(-6)}`}
        sub={`Placed ${new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
        }).format(order.createdAt)} · ${order.fulfillment}`}
        right={
          <StatusControl orderId={order.id} status={order.status} action={updateOrderStatus} />
        }
      />

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <CardTitle title="Items" note={`${order.items.length} lines`} />
          <div className="space-y-2.5">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between text-[13.5px]">
                <span style={{ color: "var(--ink)" }}>
                  {it.qty}× {it.nameSnapshot}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {formatCents(it.unitPriceCentsSnapshot * it.qty)}
                </span>
              </div>
            ))}
          </div>
          <div
            className="mt-4 pt-4 space-y-1.5 text-[13px]"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <Row l="Subtotal" v={formatCents(order.subtotalCents)} />
            {discountsCents > 0 && (
              <Row l="Discounts" v={`−${formatCents(discountsCents)}`} green />
            )}
            <Row l="Tax" v={formatCents(order.taxCents)} />
            <Row l="Fees" v={formatCents(order.feesCents)} />
            <div
              className="flex justify-between pt-2 mt-1"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                Total
              </span>
              <span className="disp text-[18px] font-medium" style={{ color: "var(--pine)" }}>
                {formatCents(order.totalCents)}
              </span>
            </div>
            {order.giftRedeemedCents > 0 && (
              <div className="pt-2 space-y-1.5">
                <Row l="Paid by gift card" v={`−${formatCents(order.giftRedeemedCents)}`} green />
                <div className="flex justify-between">
                  <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>Amount due</span>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                    {formatCents(Math.max(0, order.totalCents - order.giftRedeemedCents))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle title="Customer" />
          {order.customer ? (
            <div className="space-y-2 text-[13px]">
              <div className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
                {order.customer.name}
              </div>
              <div className="flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
                <Mail size={13} style={{ color: "var(--muted)" }} />
                {order.customer.email}
              </div>
              {order.customer.phone && (
                <div className="flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
                  <Phone size={13} style={{ color: "var(--muted)" }} />
                  {order.customer.phone}
                </div>
              )}
              {order.address && (
                <div className="flex items-start gap-2" style={{ color: "var(--ink-soft)" }}>
                  <MapPin size={13} style={{ color: "var(--muted)", marginTop: 2 }} />
                  <span>
                    {order.address}
                    {order.zone ? ` · ${order.zone}` : ""}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              Guest order — no customer record.
            </p>
          )}
        </Card>
      </div>
    </Page>
  );
}

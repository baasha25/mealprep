import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, Star, Repeat } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Card, CardTitle, Kpi } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { STATUS_META, ORDER_TYPE_LABEL } from "@/lib/order-status";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const customer = await db.customer.findFirst({
    where: { id, businessId: business.id },
    include: {
      addresses: true,
      orders: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      },
      subscriptions: { include: { plan: true } },
    },
  });
  if (!customer) notFound();

  const spendCents = customer.orders.reduce((s, o) => s + o.totalCents, 0);
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);

  return (
    <Page>
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-[12.5px] mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> All customers
      </Link>
      <Head kicker="Customer" title={customer.name} sub={`Member since ${fmtDate(customer.createdAt)}`} />

      <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
        <Kpi icon={<Repeat size={16} />} label="Orders" value={customer.orders.length} />
        <Kpi label="Lifetime spend" value={formatCents(spendCents)} />
        <Kpi icon={<Star size={16} />} label="Loyalty points" value={customer.loyaltyPoints} />
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
        <div className="space-y-4">
          <Card>
            <CardTitle title="Contact" />
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
                <Mail size={13} style={{ color: "var(--muted)" }} /> {customer.email}
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2" style={{ color: "var(--ink-soft)" }}>
                  <Phone size={13} style={{ color: "var(--muted)" }} /> {customer.phone}
                </div>
              )}
              {customer.addresses.map((a) => (
                <div key={a.id} className="flex items-start gap-2" style={{ color: "var(--ink-soft)" }}>
                  <MapPin size={13} style={{ color: "var(--muted)", marginTop: 2 }} />
                  <span>{[a.line1, a.city, a.region, a.zone].filter(Boolean).join(", ")}</span>
                </div>
              ))}
              {(customer.allergens.length > 0 || customer.dietaryPrefs.length > 0) && (
                <div className="pt-2 mt-1 flex flex-wrap gap-1" style={{ borderTop: "1px solid var(--line)" }}>
                  {customer.dietaryPrefs.map((d) => (
                    <span key={d} className="text-[11px] px-2 py-0.5 rounded capitalize" style={{ background: "var(--paper)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{d}</span>
                  ))}
                  {customer.allergens.map((a) => (
                    <span key={a} className="text-[11px] px-2 py-0.5 rounded capitalize" style={{ background: "color-mix(in srgb, var(--clay) 9%, transparent)", color: "var(--clay)" }}>no {a}</span>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {customer.subscriptions.length > 0 && (
            <Card>
              <CardTitle icon={<Repeat size={15} />} title="Subscriptions" />
              <div className="space-y-2">
                {customer.subscriptions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: "var(--ink)" }}>{s.plan.name} · {s.frequency}</span>
                    <span className="text-[11.5px] px-2 py-0.5 rounded-md font-medium" style={{ background: s.status === "active" ? "color-mix(in srgb, var(--pine) 12%, transparent)" : "var(--sand)", color: s.status === "active" ? "var(--pine)" : "var(--muted)" }}>{s.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card>
          <CardTitle title="Order history" note={`${customer.orders.length} orders`} />
          {customer.orders.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {customer.orders.map((o) => {
                const meta = STATUS_META[o.status as keyof typeof STATUS_META];
                return (
                  <Link
                    key={o.id}
                    href={`/dashboard/orders/${o.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                        #{o.id.slice(-6)} · {ORDER_TYPE_LABEL[o.type] ?? o.type}
                      </div>
                      <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                        {o._count.items} items · {fmtDate(o.createdAt)}
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-md font-medium" style={{ background: meta?.bg, color: meta?.fg }}>{meta?.label ?? o.status}</span>
                    <span className="disp text-[14px] font-medium" style={{ color: "var(--ink)" }}>{formatCents(o.totalCents)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}

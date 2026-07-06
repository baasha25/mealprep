import { FileSpreadsheet, Download, TrendingUp, Receipt, Percent, CreditCard } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle, Row } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";

export default async function ReportsPage() {
  const { business } = await requireBusiness();
  const orders = await db.order.findMany({
    where: { businessId: business.id },
    select: { type: true, subtotalCents: true, taxCents: true, feesCents: true, totalCents: true, giftRedeemedCents: true },
  });

  const sum = (f: (o: (typeof orders)[number]) => number) => orders.reduce((s, o) => s + f(o), 0);
  const grossSales = sum((o) => o.subtotalCents);
  const taxCollected = sum((o) => o.taxCents);
  const feesCollected = sum((o) => o.feesCents);
  const totalBilled = sum((o) => o.totalCents);
  const giftRedeemed = sum((o) => o.giftRedeemedCents);
  const discounts = sum((o) => o.subtotalCents + o.taxCents + o.feesCents - o.totalCents);

  const byType = new Map<string, { count: number; total: number }>();
  for (const o of orders) {
    const cur = byType.get(o.type) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += o.totalCents;
    byType.set(o.type, cur);
  }

  return (
    <Page>
      <Head
        kicker="Finance"
        title="Reports & exports"
        sub="Sales, tax, and order data — summarized here, and downloadable for your bookkeeper."
      />

      <div className="grid sm:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<TrendingUp size={16} />} label="Gross sales" value={formatCents(grossSales)} />
        <Kpi icon={<Percent size={16} />} label="Tax collected" value={formatCents(taxCollected)} />
        <Kpi icon={<Receipt size={16} />} label="Total billed" value={formatCents(totalBilled)} />
        <Kpi icon={<CreditCard size={16} />} label="Orders" value={orders.length} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle title="Financial summary" note="All-time" />
          <div className="space-y-1.5 text-[13px]">
            <Row l="Gross sales (menu value)" v={formatCents(grossSales)} />
            <Row l="Discounts given" v={`−${formatCents(discounts)}`} green />
            <Row l="Tax collected" v={formatCents(taxCollected)} />
            <Row l="Delivery & processing fees" v={formatCents(feesCollected)} />
            <div className="flex justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>Total billed</span>
              <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{formatCents(totalBilled)}</span>
            </div>
            <Row l="Paid by gift cards" v={formatCents(giftRedeemed)} />
          </div>
          <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>
            Tax collected is what you&apos;ve charged customers — hand this to your bookkeeper for remittance.
          </p>
        </Card>

        <Card>
          <CardTitle title="Revenue by channel" />
          <div className="space-y-2.5">
            {[...byType.entries()].sort((a, b) => b[1].total - a[1].total).map(([type, v]) => {
              const pct = totalBilled ? Math.round((v.total / totalBilled) * 100) : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-[12.5px] mb-1">
                    <span style={{ color: "var(--ink)" }}>{ORDER_TYPE_LABEL[type] ?? type} <span style={{ color: "var(--muted)" }}>· {v.count} orders</span></span>
                    <span style={{ color: "var(--muted)" }}>{formatCents(v.total)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--sand)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--pine)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Exports */}
      <Card className="mt-4">
        <CardTitle icon={<FileSpreadsheet size={15} />} title="Download reports (CSV)" note="Opens in Excel / Google Sheets" />
        <div className="flex flex-wrap gap-3">
          <a
            href="/dashboard/reports/orders"
            download
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--paper)" }}
          >
            <Download size={15} /> Orders ledger
          </a>
          <a
            href="/dashboard/reports/meals"
            download
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--paper)" }}
          >
            <Download size={15} /> Meal sales
          </a>
        </div>
        <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>
          The orders ledger includes a date on every row, so your bookkeeper can filter to any period in a spreadsheet.
        </p>
      </Card>
    </Page>
  );
}

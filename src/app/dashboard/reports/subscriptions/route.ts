import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { slugify } from "@/lib/slug";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const FREQ_LABEL: Record<string, string> = { weekly: "Weekly", biweekly: "Every 2 weeks" };

// Downloadable subscriptions list — who's on a recurring plan and their next delivery.
export async function GET() {
  const { business } = await requireOwner();

  const subs = await db.subscription.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      plan: { select: { name: true } },
    },
  });

  const rows: (string | number)[][] = [
    [business.name],
    [`Subscriptions — generated ${isoDate(new Date())}`],
    [],
    ["Customer", "Email", "Plan", "Frequency", "Status", "Next delivery", "Delivery days", "Started"],
  ];
  for (const s of subs) {
    rows.push([
      s.customer?.name ?? "",
      s.customer?.email ?? "",
      s.plan?.name ?? "",
      FREQ_LABEL[s.frequency] ?? s.frequency,
      s.status,
      s.nextDeliveryDate ? isoDate(s.nextDeliveryDate) : "",
      s.preferredDeliveryDays.join(" "),
      isoDate(s.createdAt),
    ]);
  }

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(business.name)}-subscriptions-${isoDate(new Date())}.csv"`,
    },
  });
}

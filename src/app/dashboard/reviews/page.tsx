import { MessageSquare } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi } from "@/components/ui";
import { ReviewsInbox, type InboxReview } from "./reviews-inbox";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const { business } = await requireBusiness();

  const [rows, settings] = await Promise.all([
    db.mealReview.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      include: { meal: { select: { name: true } }, customer: { select: { name: true } } },
    }),
    db.businessSettings.findFirst({ where: { businessId: business.id }, select: { autoApproveReviews: true } }),
  ]);

  const reviews: InboxReview[] = rows.map((r) => ({
    id: r.id,
    mealName: r.meal.name,
    customerName: r.customer?.name ?? "Customer",
    rating: r.rating,
    comment: r.comment,
    reply: r.reply,
    status: r.status as InboxReview["status"],
    createdAt: r.createdAt.toISOString(),
  }));

  const pending = reviews.filter((r) => r.status === "pending").length;
  const approved = reviews.filter((r) => r.status === "approved").length;
  const rated = reviews.filter((r) => r.status === "approved");
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;

  return (
    <Page>
      <Head
        kicker="Sales"
        title="Reviews"
        sub={
          settings?.autoApproveReviews
            ? "Customer reviews publish automatically (auto-approve is on in Settings). You can still hide any review or reply publicly."
            : "Customer reviews wait here until you approve them — nothing shows on your storefront until you say so. Every review is from a verified order."
        }
      />
      <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
        <Kpi icon={<MessageSquare size={16} />} label="Awaiting approval" value={pending} />
        <Kpi icon={<MessageSquare size={16} />} label="Live on storefront" value={approved} />
        <Kpi icon={<MessageSquare size={16} />} label="Average rating" value={avg ? avg.toFixed(1) : "—"} />
      </div>
      <ReviewsInbox reviews={reviews} />
    </Page>
  );
}

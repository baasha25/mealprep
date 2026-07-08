import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { PlansManager, type PlanRow } from "./plans-manager";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const { business } = await requireOwner();
  const plans = await db.plan.findMany({
    where: { businessId: business.id },
    orderBy: { mealsPerWeek: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  const rows: PlanRow[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    mealsPerWeek: p.mealsPerWeek,
    perMealPriceCents: p.perMealPriceCents,
    active: p.active,
    subscriberCount: p._count.subscriptions,
  }));

  return (
    <Page>
      <Head
        kicker="Selling"
        title="Meal Plans"
        sub="Name and price the subscription plans customers can choose on your storefront."
      />
      <PlansManager plans={rows} />
    </Page>
  );
}

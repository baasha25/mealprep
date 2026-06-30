import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { Pos, type PosMeal } from "./pos";

export default async function PosPage() {
  const { business } = await requireBusiness();
  const [meals, settings] = await Promise.all([
    db.meal.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, priceCents: true, diet: true, swatch: true },
    }),
    db.businessSettings.findUnique({ where: { businessId: business.id }, select: { taxRateBps: true } }),
  ]);

  const posMeals: PosMeal[] = meals;

  return (
    <Page>
      <Head kicker="In-store" title="POS Terminal" sub="Ring up walk-in orders. Tax applies; no delivery or processing fees." />
      <Pos meals={posMeals} taxRateBps={settings?.taxRateBps ?? 0} />
    </Page>
  );
}

import Link from "next/link";
import { Plus, ScanLine } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { cldImage } from "@/lib/cloudinary";
import { MenuLibrary, type MenuMeal } from "./menu-library";

export default async function MenuPage() {
  const { business } = await requireBusiness();
  const meals = await db.meal.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { ingredients: true, reviews: true } } },
  });

  const ratingAgg = await db.mealReview.groupBy({
    by: ["mealId"],
    where: { businessId: business.id },
    _avg: { rating: true },
  });
  const ratingByMeal = new Map(ratingAgg.map((r) => [r.mealId, r._avg.rating ?? 0]));

  const items: MenuMeal[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    priceCents: m.priceCents,
    swatch: m.swatch,
    imageUrl: cldImage(m.imageUrl, { w: 480, h: 220 }) ?? m.imageUrl,
    diet: m.diet,
    calories: m.calories,
    active: m.active,
    ingredientCount: m._count.ingredients,
    reviewCount: m._count.reviews,
    rating: ratingByMeal.get(m.id) ?? 0,
    stepCount: m.methodSteps.length,
  }));

  return (
    <Page>
      <Head
        kicker="Kitchen"
        title="Menu & recipes"
        sub="Every meal is a saved recipe. Retire one to take it off the storefront — its recipe is kept so you can bring it back anytime."
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/menu/import"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border"
              style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}
            >
              <ScanLine size={15} /> Import from photo
            </Link>
            <Link
              href="/dashboard/menu/new"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              <Plus size={15} /> Add menu item
            </Link>
          </div>
        }
      />

      <MenuLibrary meals={items} />
    </Page>
  );
}

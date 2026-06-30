import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { bpsToPercent } from "@/lib/money";
import { MealForm, type MealFormInitial } from "../../meal-form";
import { updateMeal } from "../../actions";

export default async function EditMealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business } = await requireBusiness();

  const meal = await db.meal.findFirst({
    where: { id, businessId: business.id },
    include: {
      ingredients: { include: { ingredient: true } },
    },
  });
  if (!meal) notFound();

  const initial: MealFormInitial = {
    name: meal.name,
    description: meal.description ?? "",
    diet: meal.diet,
    price: String(meal.priceCents / 100),
    calories: String(meal.calories),
    proteinG: String(meal.proteinG),
    carbsG: String(meal.carbsG),
    fatG: String(meal.fatG),
    allergens: meal.allergens,
    active: meal.active,
    swatch: meal.swatch,
    ingredients: meal.ingredients.map((mi) => ({
      name: mi.ingredient.name,
      qty: String(mi.qty),
      unit: mi.unit,
      trimPercent: String(bpsToPercent(mi.trimBps)),
    })),
  };

  // Bind the meal id so the client form gets a (prev, formData) action.
  const action = updateMeal.bind(null, meal.id);

  return (
    <Page>
      <Head kicker="Menu" title={`Edit ${meal.name}`} sub="Update this meal." />
      <MealForm action={action} initial={initial} submitLabel="Save changes" />
    </Page>
  );
}

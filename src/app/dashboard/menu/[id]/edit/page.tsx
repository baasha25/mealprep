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
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" }, include: { ingredients: { include: { ingredient: true } } } } },
      },
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
    imageUrl: meal.imageUrl ?? "",
    shelfLifeDays: meal.shelfLifeDays != null ? String(meal.shelfLifeDays) : "",
    expectedServings: meal.expectedServings != null ? String(meal.expectedServings) : "",
    actualServings: meal.actualServings != null ? String(meal.actualServings) : "",
    prepNotes: meal.prepNotes ?? "",
    methodSteps: meal.methodSteps,
    ingredients: meal.ingredients.map((mi) => ({
      name: mi.ingredient.name,
      qty: String(mi.qty),
      unit: mi.unit,
      trimPercent: String(bpsToPercent(mi.trimBps)),
    })),
    optionGroups: meal.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: String(g.minSelect),
      maxSelect: String(g.maxSelect),
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: String(o.priceDeltaCents / 100),
        isDefault: o.isDefault,
        allergens: o.allergens,
        ingredients: o.ingredients.map((r) => ({
          name: r.ingredient.name,
          qty: String(r.qty),
          unit: r.unit,
          trimPercent: String(bpsToPercent(r.trimBps)),
        })),
      })),
    })),
  };

  // Bind the meal id so the client form gets a (prev, formData) action.
  const action = updateMeal.bind(null, meal.id);
  const ingredientOptions = await db.ingredient.findMany({
    where: { businessId: business.id },
    orderBy: { name: "asc" },
    select: { name: true, unit: true, densityGPerMl: true, calPerUnit: true, proteinPerUnit: true, carbsPerUnit: true, fatPerUnit: true },
  });

  return (
    <Page>
      <Head kicker="Menu" title={`Edit ${meal.name}`} sub="Update this meal." />
      <MealForm action={action} initial={initial} submitLabel="Save changes" ingredientOptions={ingredientOptions} />
    </Page>
  );
}

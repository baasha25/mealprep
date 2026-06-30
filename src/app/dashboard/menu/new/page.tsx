import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { MealForm, type MealFormInitial } from "../meal-form";
import { createMeal } from "../actions";
import { swatchForIndex } from "@/lib/menu-constants";

export default async function NewMealPage() {
  const { business } = await requireBusiness();
  const count = await db.meal.count({ where: { businessId: business.id } });

  const initial: MealFormInitial = {
    name: "",
    description: "",
    diet: null,
    price: "",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    allergens: [],
    active: true,
    swatch: swatchForIndex(count),
    ingredients: [],
  };

  return (
    <Page>
      <Head
        kicker="Menu"
        title="New menu item"
        sub="Add a meal to your storefront."
      />
      <MealForm action={createMeal} initial={initial} submitLabel="Save to menu" />
    </Page>
  );
}

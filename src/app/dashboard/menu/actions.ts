"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { dollarsToCents, percentToBps } from "@/lib/money";
import { DIET_OPTS, ALLERGENS, UNITS } from "@/lib/menu-constants";

const IngredientInput = z.object({
  name: z.string().trim().min(1),
  qty: z.coerce.number().min(0),
  unit: z.enum(UNITS),
  trimPercent: z.coerce.number().min(0).max(100),
});

const MealInput = z.object({
  name: z.string().trim().min(1, "Meal name is required").max(120),
  description: z.string().trim().max(280).optional().default(""),
  diet: z.enum(DIET_OPTS).nullable(),
  price: z.coerce.number().min(0).max(100000),
  calories: z.coerce.number().int().min(0).max(100000),
  proteinG: z.coerce.number().int().min(0).max(10000),
  carbsG: z.coerce.number().int().min(0).max(10000),
  fatG: z.coerce.number().int().min(0).max(10000),
  allergens: z.array(z.enum(ALLERGENS)),
  active: z.boolean(),
  swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type MealActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

// Parse the flat FormData (incl. repeated ingredient fields) into typed input.
function parseMealForm(formData: FormData) {
  const names = formData.getAll("ingName").map(String);
  const qtys = formData.getAll("ingQty").map(String);
  const units = formData.getAll("ingUnit").map(String);
  const trims = formData.getAll("ingTrim").map(String);

  const ingredientRows = names
    .map((name, i) => ({
      name: name.trim(),
      qty: qtys[i] ?? "0",
      unit: units[i] ?? "oz",
      trimPercent: trims[i] === "" || trims[i] == null ? "0" : trims[i],
    }))
    .filter((r) => r.name.length > 0);

  const dietRaw = String(formData.get("diet") ?? "");
  return {
    base: {
      name: formData.get("name"),
      description: formData.get("description") ?? "",
      diet: dietRaw === "" ? null : dietRaw,
      price: formData.get("price"),
      calories: formData.get("calories") || 0,
      proteinG: formData.get("proteinG") || 0,
      carbsG: formData.get("carbsG") || 0,
      fatG: formData.get("fatG") || 0,
      allergens: formData.getAll("allergens").map(String),
      active: formData.get("active") === "on",
      swatch: formData.get("swatch"),
    },
    ingredientRows,
  };
}

function collectErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/**
 * Replace a meal's recipe links. Ingredients are per-business entities
 * (unique by name); we upsert each one, then recreate the MealIngredient rows.
 * Stored: trim as basis points (the trim-aware purchasing engine reads these later).
 */
async function syncIngredients(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  businessId: string,
  mealId: string,
  rows: z.infer<typeof IngredientInput>[],
) {
  await tx.mealIngredient.deleteMany({ where: { mealId } });
  for (const row of rows) {
    const ingredient = await tx.ingredient.upsert({
      where: { businessId_name: { businessId, name: row.name } },
      create: { businessId, name: row.name, unit: row.unit },
      update: {},
    });
    await tx.mealIngredient.create({
      data: {
        mealId,
        ingredientId: ingredient.id,
        qty: row.qty,
        unit: row.unit,
        trimBps: percentToBps(row.trimPercent),
      },
    });
  }
}

export async function createMeal(
  _prev: MealActionState,
  formData: FormData,
): Promise<MealActionState> {
  const { business } = await requireBusiness();
  const { base, ingredientRows } = parseMealForm(formData);

  const parsed = MealInput.safeParse(base);
  const ingParsed = z.array(IngredientInput).safeParse(ingredientRows);
  if (!parsed.success || !ingParsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: parsed.success ? {} : collectErrors(parsed.error),
    };
  }
  const d = parsed.data;

  await db.$transaction(async (tx) => {
    const meal = await tx.meal.create({
      data: {
        businessId: business.id,
        name: d.name,
        description: d.description || null,
        diet: d.diet,
        priceCents: dollarsToCents(d.price),
        swatch: d.swatch,
        calories: d.calories,
        proteinG: d.proteinG,
        carbsG: d.carbsG,
        fatG: d.fatG,
        allergens: d.allergens,
        active: d.active,
      },
    });
    await syncIngredients(tx, business.id, meal.id, ingParsed.data);
  });

  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard");
  redirect("/dashboard/menu");
}

export async function updateMeal(
  mealId: string,
  _prev: MealActionState,
  formData: FormData,
): Promise<MealActionState> {
  const { business } = await requireBusiness();

  // Tenant check: the meal must belong to this business.
  const existing = await db.meal.findFirst({
    where: { id: mealId, businessId: business.id },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "Meal not found." };

  const { base, ingredientRows } = parseMealForm(formData);
  const parsed = MealInput.safeParse(base);
  const ingParsed = z.array(IngredientInput).safeParse(ingredientRows);
  if (!parsed.success || !ingParsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: parsed.success ? {} : collectErrors(parsed.error),
    };
  }
  const d = parsed.data;

  await db.$transaction(async (tx) => {
    await tx.meal.update({
      where: { id: mealId },
      data: {
        name: d.name,
        description: d.description || null,
        diet: d.diet,
        priceCents: dollarsToCents(d.price),
        swatch: d.swatch,
        calories: d.calories,
        proteinG: d.proteinG,
        carbsG: d.carbsG,
        fatG: d.fatG,
        allergens: d.allergens,
        active: d.active,
      },
    });
    await syncIngredients(tx, business.id, mealId, ingParsed.data);
  });

  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard");
  redirect("/dashboard/menu");
}

export async function toggleMealActive(formData: FormData) {
  const { business } = await requireBusiness();
  const mealId = String(formData.get("mealId"));
  const meal = await db.meal.findFirst({
    where: { id: mealId, businessId: business.id },
    select: { active: true },
  });
  if (!meal) return;
  await db.meal.update({
    where: { id: mealId },
    data: { active: !meal.active },
  });
  revalidatePath("/dashboard/menu");
}

export async function deleteMeal(formData: FormData) {
  const { business } = await requireBusiness();
  const mealId = String(formData.get("mealId"));
  // Scope to tenant before deleting.
  const meal = await db.meal.findFirst({
    where: { id: mealId, businessId: business.id },
    select: { id: true },
  });
  if (!meal) return;
  // OrderItem.mealId is nullable (snapshots preserve history); a meal still
  // referenced by an active subscription selection will fail the FK — caught here.
  try {
    await db.meal.delete({ where: { id: mealId } });
  } catch {
    // Fall back to deactivating so history/subscriptions stay intact.
    await db.meal.update({ where: { id: mealId }, data: { active: false } });
  }
  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard");
}

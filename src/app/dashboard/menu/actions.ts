"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness, assertWritable } from "@/lib/auth";
import { dollarsToCents, percentToBps } from "@/lib/money";
import { DIET_OPTS, ALLERGENS, UNITS } from "@/lib/menu-constants";
import {
  CLOUDINARY_ENABLED,
  cloudinaryPublicConfig,
  signCloudinaryParams,
  isAllowedMealImageUrl,
} from "@/lib/cloudinary";

const IngredientInput = z.object({
  name: z.string().trim().min(1),
  qty: z.coerce.number().min(0),
  unit: z.enum(UNITS),
  trimPercent: z.coerce.number().min(0).max(100),
});

const OptionInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Option needs a name").max(80),
  priceDelta: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(-1000).max(1000)),
  isDefault: z.boolean().default(false),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  ingredients: z.array(IngredientInput).max(30).default([]),
});
const OptionGroupInput = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Group needs a name").max(60),
    minSelect: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(0).max(10)),
    maxSelect: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(1).max(10)),
    options: z.array(OptionInput).min(1, "Add at least one option").max(30),
  })
  .refine((g) => g.maxSelect >= g.minSelect, { message: "max must be ≥ min" });
type OptionGroupIn = z.infer<typeof OptionGroupInput>;

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
  // Days the finished meal keeps; blank = use the kitchen default on labels.
  shelfLifeDays: z.preprocess(
    (v) => (v === "" || v == null || v === "0" ? null : v),
    z.coerce.number().int().min(1).max(60).nullable(),
  ),
  // Recipe yield: servings the recipe is costed for vs. what's actually produced.
  // Blank = unset (no yield tracking). Used to flag a real-vs-expected cost gap.
  expectedServings: z.preprocess(
    (v) => (v === "" || v == null || v === "0" ? null : v),
    z.coerce.number().int().min(1).max(10000).nullable(),
  ),
  actualServings: z.preprocess(
    (v) => (v === "" || v == null || v === "0" ? null : v),
    z.coerce.number().int().min(1).max(10000).nullable(),
  ),
  // Recipe method — ordered cooking steps + free-form prep notes. Kept with the
  // meal so a retired recipe can be brought back intact.
  methodSteps: z.array(z.string().trim().min(1).max(1000)).max(60),
  prepNotes: z.string().trim().max(2000).optional().default(""),
  // Customer-facing photo URL from the client-side Cloudinary upload. Only accept
  // a genuine Cloudinary delivery URL; anything else is ignored (stored as null).
  imageUrl: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s && isAllowedMealImageUrl(s) ? s : null;
  }, z.string().nullable()),
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

  // Build-your-own groups arrive as one JSON field (nested structure). Empty
  // names are dropped so an untouched blank row never blocks saving.
  let optionGroupRows: unknown[] = [];
  try {
    const raw = String(formData.get("optionGroups") ?? "");
    const parsedRaw = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsedRaw)) {
      optionGroupRows = parsedRaw
        .map((g) => {
          const grp = g as { options?: unknown[]; name?: unknown };
          const options = (Array.isArray(grp.options) ? grp.options : [])
            .map((o) => {
              const opt = o as { ingredients?: unknown[]; name?: unknown };
              const ingredients = (Array.isArray(opt.ingredients) ? opt.ingredients : []).filter(
                (r) => String((r as { name?: unknown }).name ?? "").trim().length > 0,
              );
              return { ...(o as object), ingredients };
            })
            .filter((o) => String((o as { name?: unknown }).name ?? "").trim().length > 0);
          return { ...(g as object), options };
        })
        .filter((g) => String((g as { name?: unknown }).name ?? "").trim().length > 0);
    }
  } catch {
    optionGroupRows = [];
  }

  const methodSteps = formData
    .getAll("methodStep")
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);

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
      shelfLifeDays: formData.get("shelfLifeDays") ?? "",
      expectedServings: formData.get("expectedServings") ?? "",
      actualServings: formData.get("actualServings") ?? "",
      methodSteps,
      prepNotes: formData.get("prepNotes") ?? "",
      imageUrl: formData.get("imageUrl") ?? "",
    },
    ingredientRows,
    optionGroupRows,
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

/**
 * Replace a meal's build-your-own groups. Option/group IDs are PRESERVED when
 * they still exist (so saved subscription picks and carts keep pointing at the
 * same option); anything missing from the submitted set is removed. Each
 * option's ingredients are upserted by name like the base recipe.
 */
async function syncOptionGroups(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  businessId: string,
  mealId: string,
  groups: OptionGroupIn[],
) {
  const existing = await tx.mealOptionGroup.findMany({
    where: { mealId },
    select: { id: true, options: { select: { id: true } } },
  });
  const existingGroupIds = new Set(existing.map((g) => g.id));
  const keepGroupIds: string[] = [];

  for (const [gi, g] of groups.entries()) {
    const gid = g.id && existingGroupIds.has(g.id) ? g.id : undefined;
    const data = { name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, sortOrder: gi };
    const group = gid
      ? await tx.mealOptionGroup.update({ where: { id: gid }, data })
      : await tx.mealOptionGroup.create({ data: { ...data, mealId } });
    keepGroupIds.push(group.id);

    const existingOptIds = new Set(existing.find((e) => e.id === group.id)?.options.map((o) => o.id) ?? []);
    const keepOptIds: string[] = [];
    for (const [oi, o] of g.options.entries()) {
      const oid = o.id && existingOptIds.has(o.id) ? o.id : undefined;
      const odata = { name: o.name, priceDeltaCents: dollarsToCents(o.priceDelta), isDefault: o.isDefault, allergens: o.allergens, sortOrder: oi, active: true };
      const opt = oid
        ? await tx.mealOption.update({ where: { id: oid }, data: odata })
        : await tx.mealOption.create({ data: { ...odata, groupId: group.id } });
      keepOptIds.push(opt.id);

      await tx.mealOptionIngredient.deleteMany({ where: { optionId: opt.id } });
      for (const row of o.ingredients) {
        const ingredient = await tx.ingredient.upsert({
          where: { businessId_name: { businessId, name: row.name } },
          create: { businessId, name: row.name, unit: row.unit },
          update: {},
        });
        await tx.mealOptionIngredient.create({
          data: { optionId: opt.id, ingredientId: ingredient.id, qty: row.qty, unit: row.unit, trimBps: percentToBps(row.trimPercent) },
        });
      }
    }
    await tx.mealOption.deleteMany({ where: { groupId: group.id, id: { notIn: keepOptIds } } });
  }
  await tx.mealOptionGroup.deleteMany({ where: { mealId, id: { notIn: keepGroupIds } } });
}

export async function createMeal(
  _prev: MealActionState,
  formData: FormData,
): Promise<MealActionState> {
  const { business } = await requireBusiness();
  await assertWritable(business);
  const { base, ingredientRows, optionGroupRows } = parseMealForm(formData);

  const parsed = MealInput.safeParse(base);
  const ingParsed = z.array(IngredientInput).safeParse(ingredientRows);
  const optParsed = z.array(OptionGroupInput).max(10).safeParse(optionGroupRows);
  if (!parsed.success || !ingParsed.success || !optParsed.success) {
    return {
      ok: false,
      message: !optParsed.success ? `Options: ${optParsed.error.issues[0]?.message ?? "check the option groups"}` : "Please fix the highlighted fields.",
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
        imageUrl: d.imageUrl,
        calories: d.calories,
        proteinG: d.proteinG,
        carbsG: d.carbsG,
        fatG: d.fatG,
        allergens: d.allergens,
        active: d.active,
        shelfLifeDays: d.shelfLifeDays,
        expectedServings: d.expectedServings,
        actualServings: d.actualServings,
        methodSteps: d.methodSteps,
        prepNotes: d.prepNotes || null,
      },
    });
    await syncIngredients(tx, business.id, meal.id, ingParsed.data);
    await syncOptionGroups(tx, business.id, meal.id, optParsed.data);
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
  await assertWritable(business);

  // Tenant check: the meal must belong to this business.
  const existing = await db.meal.findFirst({
    where: { id: mealId, businessId: business.id },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "Meal not found." };

  const { base, ingredientRows, optionGroupRows } = parseMealForm(formData);
  const parsed = MealInput.safeParse(base);
  const ingParsed = z.array(IngredientInput).safeParse(ingredientRows);
  const optParsed = z.array(OptionGroupInput).max(10).safeParse(optionGroupRows);
  if (!parsed.success || !ingParsed.success || !optParsed.success) {
    return {
      ok: false,
      message: !optParsed.success ? `Options: ${optParsed.error.issues[0]?.message ?? "check the option groups"}` : "Please fix the highlighted fields.",
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
        imageUrl: d.imageUrl,
        calories: d.calories,
        proteinG: d.proteinG,
        carbsG: d.carbsG,
        fatG: d.fatG,
        allergens: d.allergens,
        active: d.active,
        shelfLifeDays: d.shelfLifeDays,
        expectedServings: d.expectedServings,
        actualServings: d.actualServings,
        methodSteps: d.methodSteps,
        prepNotes: d.prepNotes || null,
      },
    });
    await syncIngredients(tx, business.id, mealId, ingParsed.data);
    await syncOptionGroups(tx, business.id, mealId, optParsed.data);
  });

  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard");
  redirect("/dashboard/menu");
}

export type UploadSignature =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
    }
  | { ok: false; message: string };

/**
 * Mint a short-lived signature so the browser can upload a meal photo straight
 * to Cloudinary without the API secret ever leaving the server. Scoped to the
 * caller's business (its own folder) and owner-gated via requireBusiness.
 */
export async function signMealImageUpload(): Promise<UploadSignature> {
  const { business } = await requireBusiness();
  if (!CLOUDINARY_ENABLED) {
    return { ok: false, message: "Photo uploads aren't set up yet." };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `prepflow/meals/${business.id}`;
  const signature = signCloudinaryParams({ folder, timestamp });
  const { cloudName, apiKey } = cloudinaryPublicConfig();
  return { ok: true, cloudName, apiKey, timestamp, signature, folder };
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

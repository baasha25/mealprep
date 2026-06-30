"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { dollarsToCents } from "@/lib/money";

const Input = z.object({
  ingredientId: z.string().min(1),
  cost: z.coerce.number().min(0).max(100000),
});

export async function updateIngredientCost(formData: FormData) {
  const { business } = await requireBusiness();
  const parsed = Input.safeParse({
    ingredientId: formData.get("ingredientId"),
    cost: formData.get("cost"),
  });
  if (!parsed.success) return;

  // Tenant guard: ingredient must belong to this business.
  const ing = await db.ingredient.findFirst({
    where: { id: parsed.data.ingredientId, businessId: business.id },
    select: { id: true },
  });
  if (!ing) return;

  await db.ingredient.update({
    where: { id: parsed.data.ingredientId },
    data: { costPerUnitCents: dollarsToCents(parsed.data.cost) },
  });

  revalidatePath("/dashboard/purchasing");
}

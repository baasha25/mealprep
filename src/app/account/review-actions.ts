"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCustomerContext } from "@/lib/customer-auth";

export type ReviewState = { ok: boolean; message: string };

const ReviewInput = z.object({
  mealId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default(""),
});

/** A signed-in customer rates/reviews a meal (one review per meal, upserted). */
export async function submitReview(input: { mealId: string; rating: number; comment?: string }): Promise<ReviewState> {
  const ctx = await getCustomerContext();
  if (!ctx) return { ok: false, message: "Please sign in to review." };

  const parsed = ReviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid review." };
  const d = parsed.data;

  // Meal must belong to the customer's business.
  const meal = await db.meal.findFirst({
    where: { id: d.mealId, businessId: ctx.customer.businessId },
    select: { id: true },
  });
  if (!meal) return { ok: false, message: "Meal not found." };

  await db.mealReview.upsert({
    where: { mealId_customerId: { mealId: meal.id, customerId: ctx.customer.id } },
    create: { businessId: ctx.customer.businessId, mealId: meal.id, customerId: ctx.customer.id, rating: d.rating, comment: d.comment || null },
    update: { rating: d.rating, comment: d.comment || null },
  });

  revalidatePath("/store/[slug]/account", "page");
  return { ok: true, message: "Thanks for your review!" };
}

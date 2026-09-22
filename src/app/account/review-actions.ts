"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCustomerContext } from "@/lib/customer-auth";
import { sendNewReviewNotice } from "@/lib/email";
import { appUrl } from "@/lib/app-url";

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
    select: { id: true, name: true },
  });
  if (!meal) return { ok: false, message: "Meal not found." };

  // Moderation: public only once approved. Kitchens can opt into auto-approve;
  // otherwise new reviews (and edits to existing ones) wait for the owner.
  const settings = await db.businessSettings.findFirst({
    where: { businessId: ctx.customer.businessId },
    select: { autoApproveReviews: true },
  });
  const status = settings?.autoApproveReviews ? "approved" : "pending";

  await db.mealReview.upsert({
    where: { mealId_customerId: { mealId: meal.id, customerId: ctx.customer.id } },
    create: { businessId: ctx.customer.businessId, mealId: meal.id, customerId: ctx.customer.id, rating: d.rating, comment: d.comment || null, status },
    update: { rating: d.rating, comment: d.comment || null, status },
  });

  revalidatePath("/store/[slug]/account", "page");
  revalidatePath("/store/[slug]", "page");

  // Let the owner know there's something to approve (best-effort, never blocks the customer).
  if (status === "pending") {
    try {
      const [owner, business] = await Promise.all([
        db.user.findFirst({ where: { businessId: ctx.customer.businessId, role: "owner" }, select: { email: true } }),
        db.business.findUnique({ where: { id: ctx.customer.businessId }, select: { name: true } }),
      ]);
      if (owner?.email && business) {
        await sendNewReviewNotice({
          to: owner.email,
          kitchenName: business.name,
          mealName: meal.name,
          rating: d.rating,
          comment: d.comment || null,
          reviewsUrl: `${await appUrl()}/dashboard/reviews`,
        });
      }
    } catch {
      /* notification is best-effort */
    }
  }

  return { ok: true, message: status === "approved" ? "Thanks for your review!" : "Thanks! Your review will appear once the kitchen approves it." };
}

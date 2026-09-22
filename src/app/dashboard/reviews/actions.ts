"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";

export type ReviewActionResult = { ok: boolean; message: string };
const STATUSES = ["pending", "approved", "hidden"] as const;
export type ReviewStatus = (typeof STATUSES)[number];

/** Revalidate the owner inbox + the public storefront (so approvals show immediately). */
function revalidate(slug: string | null) {
  revalidatePath("/dashboard/reviews");
  revalidatePath("/dashboard/menu");
  if (slug) revalidatePath(`/store/${slug}`);
}

/** Approve / hide / re-queue a review. Tenant-scoped: the review must belong to this kitchen. */
export async function setReviewStatus(id: string, status: ReviewStatus): Promise<ReviewActionResult> {
  const { business } = await requireBusiness();
  if (!STATUSES.includes(status)) return { ok: false, message: "Unknown status." };
  const review = await db.mealReview.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
  if (!review) return { ok: false, message: "Review not found." };
  await db.mealReview.update({ where: { id: review.id }, data: { status } });
  revalidate(business.slug);
  return { ok: true, message: status === "approved" ? "Approved — it's live on your storefront." : status === "hidden" ? "Hidden from the storefront." : "Moved back to pending." };
}

const ReplyInput = z.string().trim().max(400, "Keep replies under 400 characters.");

/** Post (or clear) the kitchen's public reply under a review. */
export async function replyToReview(id: string, reply: string): Promise<ReviewActionResult> {
  const { business } = await requireBusiness();
  const parsed = ReplyInput.safeParse(reply);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid reply." };
  const review = await db.mealReview.findFirst({ where: { id, businessId: business.id }, select: { id: true } });
  if (!review) return { ok: false, message: "Review not found." };
  const text = parsed.data;
  await db.mealReview.update({
    where: { id: review.id },
    data: { reply: text || null, repliedAt: text ? new Date() : null },
  });
  revalidate(business.slug);
  return { ok: true, message: text ? "Reply posted." : "Reply removed." };
}

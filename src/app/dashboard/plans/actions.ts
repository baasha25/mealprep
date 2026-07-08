"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { dollarsToCents } from "@/lib/money";

export type PlanActionState = { ok: boolean; message?: string };

const PlanInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Plan name is required").max(80),
  mealsPerWeek: z.coerce.number().int().min(1, "At least 1 meal per week").max(50),
  perMealPrice: z.coerce.number().min(0, "Price can't be negative").max(1000),
});

export type PlanInputT = z.infer<typeof PlanInput>;

/** Create a new plan, or update an existing one when `id` is present. */
export async function savePlan(input: PlanInputT): Promise<PlanActionState> {
  const { business } = await requireOwner();
  const parsed = PlanInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid plan." };
  }
  const data = {
    name: parsed.data.name,
    mealsPerWeek: parsed.data.mealsPerWeek,
    perMealPriceCents: dollarsToCents(parsed.data.perMealPrice),
  };

  if (parsed.data.id) {
    const existing = await db.plan.findFirst({
      where: { id: parsed.data.id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, message: "Plan not found." };
    await db.plan.update({ where: { id: parsed.data.id }, data });
    revalidatePath("/dashboard/plans");
    return { ok: true, message: "Plan updated." };
  }

  await db.plan.create({ data: { businessId: business.id, ...data } });
  revalidatePath("/dashboard/plans");
  return { ok: true, message: "Plan created." };
}

export async function togglePlanActive(id: string): Promise<void> {
  const { business } = await requireOwner();
  const plan = await db.plan.findFirst({ where: { id, businessId: business.id }, select: { active: true } });
  if (!plan) return;
  await db.plan.update({ where: { id }, data: { active: !plan.active } });
  revalidatePath("/dashboard/plans");
}

export async function deletePlan(id: string): Promise<void> {
  const { business } = await requireOwner();
  const plan = await db.plan.findFirst({
    where: { id, businessId: business.id },
    select: { _count: { select: { subscriptions: true } } },
  });
  if (!plan) return;
  // Never orphan live subscriptions — deactivate a plan that's in use instead of deleting.
  if (plan._count.subscriptions > 0) {
    await db.plan.update({ where: { id }, data: { active: false } });
  } else {
    await db.plan.delete({ where: { id } });
  }
  revalidatePath("/dashboard/plans");
}

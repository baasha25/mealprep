"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, assertWritable } from "@/lib/auth";
import { plateCostFromRecipe } from "@/lib/profitability";
import { defaultOptionIds } from "@/lib/meal-options";
import { unitsSoldBetween } from "@/lib/price-test-data";
import { formatCents } from "@/lib/money";

export type PriceTestResult = { ok: boolean; message: string };

const Start = z.object({ mealId: z.string().min(1), testPriceCents: z.number().int().min(100).max(100_000), days: z.union([z.literal(7), z.literal(14)]) });

/** Put a meal on a test price now; freeze the baseline (same-length window before today). */
export async function startPriceTest(input: { mealId: string; testPriceCents: number; days: 7 | 14 }): Promise<PriceTestResult> {
  const parsed = Start.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick a price between $1 and $1,000 and a 7- or 14-day window." };
  const { business } = await requireOwner();
  await assertWritable(business);
  const meal = await db.meal.findFirst({
    where: { id: parsed.data.mealId, businessId: business.id, active: true },
    include: { ingredients: { include: { ingredient: true } }, optionGroups: { include: { options: { include: { ingredients: { include: { ingredient: true } } } } } } },
  });
  if (!meal) return { ok: false, message: "That meal isn't on your menu." };
  if (meal.priceCents === parsed.data.testPriceCents) return { ok: false, message: "That's already the price." };
  const running = await db.priceExperiment.findFirst({ where: { businessId: business.id, mealId: meal.id, status: "running" }, select: { id: true } });
  if (running) return { ok: false, message: "This meal already has a test running — decide that one first." };
  const defaults = new Set(defaultOptionIds(meal.optionGroups));
  const optionLines = meal.optionGroups.flatMap((g) => g.options.filter((o) => defaults.has(o.id)).flatMap((o) => o.ingredients));
  const costCents = plateCostFromRecipe([...meal.ingredients, ...optionLines]);
  const now = new Date();
  const endAt = new Date(now.getTime() + parsed.data.days * 86_400_000);
  const baselineFrom = new Date(now.getTime() - parsed.data.days * 86_400_000);
  const baselineUnits = await unitsSoldBetween(business.id, meal.id, baselineFrom, now);
  await db.$transaction([
    db.priceExperiment.create({ data: { businessId: business.id, mealId: meal.id, basePriceCents: meal.priceCents, testPriceCents: parsed.data.testPriceCents, costCents, startAt: now, endAt, baselineUnits, baselineDays: parsed.data.days } }),
    db.meal.update({ where: { id: meal.id }, data: { priceCents: parsed.data.testPriceCents } }),
  ]);
  revalidatePath("/dashboard/profitability");
  revalidatePath("/dashboard/menu");
  if (business.slug) revalidatePath(`/store/${business.slug}`);
  return { ok: true, message: `${meal.name} is now ${formatCents(parsed.data.testPriceCents)} for ${parsed.data.days} days. Baseline: ${baselineUnits} sold in the ${parsed.data.days} days before.` };
}

/** Finish a test: keep the test price, or revert to the old one. */
export async function endPriceTest(id: string, decision: "keep" | "revert"): Promise<PriceTestResult> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const exp = await db.priceExperiment.findFirst({ where: { id, businessId: business.id }, include: { meal: { select: { name: true, priceCents: true } } } });
  if (!exp) return { ok: false, message: "Test not found." };
  if (exp.status !== "running") return { ok: false, message: "This test is already decided." };
  await db.$transaction([
    db.priceExperiment.update({ where: { id: exp.id }, data: { status: decision === "keep" ? "kept" : "reverted", decidedAt: new Date() } }),
    // Only touch the price if nobody changed it mid-test.
    ...(decision === "revert" && exp.meal.priceCents === exp.testPriceCents ? [db.meal.update({ where: { id: exp.mealId }, data: { priceCents: exp.basePriceCents } })] : []),
  ]);
  revalidatePath("/dashboard/profitability");
  revalidatePath("/dashboard/menu");
  if (business.slug) revalidatePath(`/store/${business.slug}`);
  return { ok: true, message: decision === "keep" ? `${exp.meal.name} stays at ${formatCents(exp.testPriceCents)}.` : `${exp.meal.name} is back to ${formatCents(exp.basePriceCents)}.` };
}

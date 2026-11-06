"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, assertWritable } from "@/lib/auth";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { weekStartFor } from "@/lib/menu-week";

const Input = z.object({
  weekStart: z.string().datetime(),
  mealIds: z.array(z.string().min(1)).max(500),
  note: z.string().trim().max(300).optional().default(""),
});

export type ScheduleResult = { ok: boolean; message: string };

/** Set which meals are on for a week (empty = whole menu) and the kitchen's note. */
export async function saveMenuWeek(input: z.infer<typeof Input>): Promise<ScheduleResult> {
  const { business } = await requireOwner();
  await assertWritable(business);
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the week." };
  const settings = await db.businessSettings.findUnique({ where: { businessId: business.id }, select: { timezone: true } });
  const weekStart = weekStartFor(new Date(parsed.data.weekStart), settings?.timezone || DEFAULT_TIMEZONE);
  // Only this kitchen's meals can be on its menu.
  const own = await db.meal.findMany({ where: { businessId: business.id, id: { in: parsed.data.mealIds } }, select: { id: true } });
  const mealIds = own.map((m) => m.id);
  const note = parsed.data.note || null;
  if (mealIds.length === 0 && !note) {
    await db.menuWeek.deleteMany({ where: { businessId: business.id, weekStart } });
  } else {
    await db.menuWeek.upsert({
      where: { businessId_weekStart: { businessId: business.id, weekStart } },
      create: { businessId: business.id, weekStart, mealIds, note },
      update: { mealIds, note },
    });
  }
  revalidatePath("/dashboard/menu/schedule");
  revalidatePath("/dashboard/menu");
  return { ok: true, message: mealIds.length ? `Saved: ${mealIds.length} meal${mealIds.length === 1 ? "" : "s"} on this week.` : "Saved: whole menu this week." };
}

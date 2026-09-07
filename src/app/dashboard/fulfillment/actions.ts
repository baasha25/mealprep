"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireBusiness, assertWritable } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLabelConfig, type LabelConfig } from "@/lib/labels";

const Input = z.object({
  showBusinessName: z.boolean(),
  showMacros: z.boolean(),
  showAllergens: z.boolean(),
  showBestBy: z.boolean(),
  footer: z.string().max(120),
});

export type LabelConfigResult = { ok: boolean; message: string };

/** Save the kitchen's meal-label design (which fields print + footer line). */
export async function saveLabelConfig(input: LabelConfig): Promise<LabelConfigResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid label settings." };

  const { business } = await requireBusiness();
  await assertWritable(business);

  const cfg = parseLabelConfig(parsed.data);
  await db.businessSettings.upsert({
    where: { businessId: business.id },
    create: { businessId: business.id, labelConfig: cfg },
    update: { labelConfig: cfg },
  });

  revalidatePath("/dashboard/fulfillment");
  return { ok: true, message: "Label design saved." };
}

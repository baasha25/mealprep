"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, assertWritable } from "@/lib/auth";
import { ANTHROPIC_ENABLED } from "@/lib/anthropic";
import { extractMenu, type MenuMealExtract } from "@/lib/menu-ocr";
import { DIET_OPTS, swatchForIndex } from "@/lib/menu-constants";

export type MenuScanResult =
  | { ok: true; businessName: string | null; meals: MenuMealExtract[] }
  | { ok: false; message: string };

/** Read an uploaded menu photo/PDF (base64) and return the meals it lists. */
export async function scanMenu(base64: string, mediaType: string): Promise<MenuScanResult> {
  await requireBusiness();
  if (!ANTHROPIC_ENABLED) {
    return { ok: false, message: "Menu import isn't set up yet — an API key is needed." };
  }
  if (!base64 || base64.length > 12_000_000) {
    return { ok: false, message: "That file is too large. Try a photo or PDF under ~8 MB." };
  }

  let extract;
  try {
    extract = await extractMenu({ base64, mediaType });
  } catch {
    return { ok: false, message: "Couldn't read that menu. Try a clearer, well-lit photo." };
  }
  if (extract.meals.length === 0) {
    return { ok: false, message: "No meals found. Try a clearer photo of the menu items." };
  }
  return { ok: true, businessName: extract.businessName, meals: extract.meals };
}

// Map an extracted diet string to one of our diet options (with a few aliases).
function normalizeDiet(raw: string | null): (typeof DIET_OPTS)[number] | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const exact = DIET_OPTS.find((d) => d.toLowerCase() === s);
  if (exact) return exact;
  if (/vegan|vegetarian|plant/.test(s)) return "Plant-Based";
  if (/keto/.test(s)) return "Keto";
  if (/low[\s-]?carb/.test(s)) return "Low Carb";
  if (/protein/.test(s)) return "High Protein";
  return null;
}

const ApplyInput = z.object({
  meals: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(280).nullable(),
        priceCents: z.coerce.number().int().min(0).max(100000),
        diet: z.string().nullable(),
      }),
    )
    .min(1, "Nothing to add.")
    .max(100),
});

export type MenuApplyResult = { ok: boolean; message: string; created?: number };

/** Create the confirmed meals as menu items. */
export async function applyMenu(input: z.infer<typeof ApplyInput>): Promise<MenuApplyResult> {
  const { business } = await requireBusiness();
  await assertWritable(business);
  const parsed = ApplyInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid meals." };
  }

  const startIndex = await db.meal.count({ where: { businessId: business.id } });
  let created = 0;
  for (const [i, m] of parsed.data.meals.entries()) {
    await db.meal.create({
      data: {
        businessId: business.id,
        name: m.name,
        description: m.description || null,
        diet: normalizeDiet(m.diet),
        priceCents: m.priceCents,
        swatch: swatchForIndex(startIndex + i),
        active: true,
      },
    });
    created++;
  }

  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard");
  return { ok: true, message: `Added ${created} meal${created === 1 ? "" : "s"} to your menu.`, created };
}

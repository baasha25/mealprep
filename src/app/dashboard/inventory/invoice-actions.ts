"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { costPerUnitFromReceipt } from "@/lib/inventory";
import { ANTHROPIC_ENABLED } from "@/lib/anthropic";
import { extractInvoice, type InvoiceLine } from "@/lib/invoice-ocr";
import type { TierKey } from "@/lib/tiers";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type ScanLine = InvoiceLine & { matchIngredientId: string | null };
export type ScanResult =
  | {
      ok: true;
      vendor: string | null;
      date: string | null;
      lines: ScanLine[];
      ingredients: { id: string; name: string; unit: string }[];
    }
  | { ok: false; message: string };

/** Read an uploaded invoice (base64) and return line items pre-matched to inventory. */
export async function scanInvoice(base64: string, mediaType: string): Promise<ScanResult> {
  const { business } = await requireBusiness();
  if ((business.tier as TierKey) !== "pro") {
    return { ok: false, message: "Invoice scanning is a Pro feature. Upgrade your plan in Settings." };
  }
  if (!ANTHROPIC_ENABLED) {
    return { ok: false, message: "Invoice scanning isn't set up yet — an API key is needed." };
  }
  if (!base64 || base64.length > 12_000_000) {
    return { ok: false, message: "That file is too large. Try a photo under ~8 MB." };
  }

  let extract;
  try {
    extract = await extractInvoice({ base64, mediaType });
  } catch {
    return { ok: false, message: "Couldn't read that invoice. Try a clearer, well-lit photo." };
  }
  if (extract.lines.length === 0) {
    return { ok: false, message: "No line items found. Try a clearer photo of the itemized section." };
  }

  const ingredients = await db.ingredient.findMany({
    where: { businessId: business.id },
    select: { id: true, name: true, unit: true },
    orderBy: { name: "asc" },
  });
  const byName = new Map(ingredients.map((i) => [norm(i.name), i.id]));

  const lines: ScanLine[] = extract.lines.map((l) => ({
    ...l,
    matchIngredientId: byName.get(norm(l.name)) ?? null,
  }));

  return { ok: true, vendor: extract.vendor, date: extract.date, lines, ingredients };
}

const ApplyInput = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        qty: z.coerce.number().positive(),
        unit: z.string().trim().min(1).max(24),
        totalCostCents: z.coerce.number().int().min(0).max(100_000_000),
        // Existing ingredient id, or null to create a new ingredient.
        ingredientId: z.string().nullable(),
      }),
    )
    .min(1, "Nothing to add."),
});

export type ApplyResult = { ok: boolean; message: string; received?: number };

/** Turn confirmed invoice lines into stock receipts (adds stock, sets real cost/unit). */
export async function applyInvoice(input: z.infer<typeof ApplyInput>): Promise<ApplyResult> {
  const { business } = await requireBusiness();
  if ((business.tier as TierKey) !== "pro") {
    return { ok: false, message: "Invoice scanning is a Pro feature." };
  }
  const parsed = ApplyInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid items." };
  }

  let received = 0;
  for (const it of parsed.data.items) {
    // Resolve to an ingredient: an explicit match, an existing same-name row, or a new one.
    let ingredientId = it.ingredientId;
    let unit = it.unit;

    if (ingredientId) {
      const ing = await db.ingredient.findFirst({
        where: { id: ingredientId, businessId: business.id },
        select: { id: true, unit: true },
      });
      if (!ing) continue; // stale mapping — skip rather than mis-file
      unit = ing.unit;
    } else {
      const existing = await db.ingredient.findFirst({
        where: { businessId: business.id, name: it.name },
        select: { id: true, unit: true },
      });
      if (existing) {
        ingredientId = existing.id;
        unit = existing.unit;
      } else {
        const created = await db.ingredient.create({
          data: {
            businessId: business.id,
            name: it.name,
            unit: it.unit,
            costPerUnitCents: costPerUnitFromReceipt(it.totalCostCents, it.qty),
          },
        });
        ingredientId = created.id;
        unit = created.unit;
      }
    }

    await db.$transaction([
      db.ingredientReceipt.create({
        data: {
          businessId: business.id,
          ingredientId,
          qtyReceived: it.qty,
          unit,
          totalCostCents: it.totalCostCents,
          note: "Invoice scan",
        },
      }),
      db.ingredient.update({
        where: { id: ingredientId },
        data: {
          stockQty: { increment: it.qty },
          costPerUnitCents: costPerUnitFromReceipt(it.totalCostCents, it.qty),
        },
      }),
    ]);
    received++;
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/purchasing");
  return { ok: true, message: `Received ${received} item${received === 1 ? "" : "s"} from the invoice.`, received };
}

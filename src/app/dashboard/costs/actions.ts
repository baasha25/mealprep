"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness, assertWritable } from "@/lib/auth";
import { dollarsToCents } from "@/lib/money";

const CostInput = z.object({
  label: z.string().trim().min(1, "Give this cost a name").max(80),
  category: z.enum(["labor", "overhead"]),
  monthly: z.coerce.number().min(0, "Can't be negative").max(10_000_000),
});

export type CostActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

function fieldErrors(err: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export async function addOperatingCost(
  _prev: CostActionState,
  formData: FormData,
): Promise<CostActionState> {
  const { business } = await requireBusiness();
  await assertWritable(business);

  const parsed = CostInput.safeParse({
    label: formData.get("label"),
    category: formData.get("category"),
    monthly: formData.get("monthly"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error) };
  }

  await db.operatingCost.create({
    data: {
      businessId: business.id,
      label: parsed.data.label,
      category: parsed.data.category,
      monthlyCents: dollarsToCents(parsed.data.monthly),
    },
  });

  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/profitability");
  return { ok: true, message: `Added ${parsed.data.label}.` };
}

export async function updateOperatingCost(formData: FormData): Promise<void> {
  const { business } = await requireBusiness();
  await assertWritable(business);

  const id = String(formData.get("id") ?? "");
  const parsed = CostInput.safeParse({
    label: formData.get("label"),
    category: formData.get("category"),
    monthly: formData.get("monthly"),
  });
  if (!id || !parsed.success) return;

  // Scope the update to this tenant — never trust the client-supplied id alone.
  await db.operatingCost.updateMany({
    where: { id, businessId: business.id },
    data: {
      label: parsed.data.label,
      category: parsed.data.category,
      monthlyCents: dollarsToCents(parsed.data.monthly),
    },
  });

  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/profitability");
}

export async function deleteOperatingCost(formData: FormData): Promise<void> {
  const { business } = await requireBusiness();
  await assertWritable(business);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.operatingCost.deleteMany({ where: { id, businessId: business.id } });

  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/profitability");
}

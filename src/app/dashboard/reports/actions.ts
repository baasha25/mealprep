"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, assertWritable } from "@/lib/auth";
import { newExportKey } from "@/lib/export-key";

export type ExportKeyResult = { ok: boolean; message: string };

/** Create or rotate the kitchen's live-link key (old links stop working). */
export async function rotateExportKey(): Promise<ExportKeyResult> {
  const { business } = await requireOwner();
  await assertWritable(business);
  await db.businessSettings.upsert({ where: { businessId: business.id }, create: { businessId: business.id, exportKey: newExportKey() }, update: { exportKey: newExportKey() } });
  revalidatePath("/dashboard/reports");
  return { ok: true, message: "Live links created. Paste one into a Google Sheet to see it fill in." };
}

/** Switch live links off. */
export async function clearExportKey(): Promise<ExportKeyResult> {
  const { business } = await requireOwner();
  await assertWritable(business);
  await db.businessSettings.updateMany({ where: { businessId: business.id }, data: { exportKey: null } });
  revalidatePath("/dashboard/reports");
  return { ok: true, message: "Live links switched off." };
}

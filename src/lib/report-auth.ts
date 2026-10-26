import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { looksLikeExportKey } from "@/lib/export-key";
import type { Business } from "@/generated/prisma/client";

/**
 * Who a CSV report is for: the signed-in owner, or — for live Google Sheets
 * links — the kitchen whose export key is in ?key=. Keys are read-only and
 * scoped to one kitchen; a bad key falls back to the normal owner check.
 */
export async function businessForReport(request: Request): Promise<Business> {
  const key = new URL(request.url).searchParams.get("key");
  if (looksLikeExportKey(key)) {
    const settings = await db.businessSettings.findUnique({ where: { exportKey: key! }, select: { businessId: true } });
    if (settings) {
      const business = await db.business.findUnique({ where: { id: settings.businessId } });
      if (business && !business.isDemo) return business;
    }
  }
  const { business } = await requireOwner();
  return business;
}

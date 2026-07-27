"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { TIERS, type TierKey } from "@/lib/tiers";

/** Change a kitchen's PrepFlow plan tier (and sync its platform fee). */
export async function setBusinessTier(businessId: string, tier: TierKey): Promise<{ ok: boolean }> {
  await requireSuperAdmin();
  if (!TIERS[tier]) return { ok: false };

  await db.$transaction([
    db.business.update({ where: { id: businessId }, data: { tier } }),
    db.businessSettings.updateMany({
      where: { businessId },
      data: { platformFeeBps: TIERS[tier].platformFeeBps },
    }),
  ]);

  revalidatePath("/admin");
  return { ok: true };
}

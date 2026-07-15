import { TIERS, type TierKey } from "@/lib/tiers";

// Order-volume metering. Tiers with a null orderLimit (Growth, Pro) are
// unlimited; Starter is capped (150/mo). "Month" = the current calendar month.

/** Start of the current calendar month (server local time). */
export function monthStart(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Non-canceled orders this kitchen has created this calendar month. */
export async function ordersThisMonth(businessId: string): Promise<number> {
  // Lazy import so the pure limit math (limitStatusFor) stays unit-testable
  // without spinning up Prisma.
  const { db } = await import("@/lib/db");
  return db.order.count({
    where: {
      businessId,
      status: { not: "canceled" },
      createdAt: { gte: monthStart() },
    },
  });
}

export type OrderLimitStatus = {
  tier: TierKey;
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null; // null = unlimited
  atLimit: boolean; // used >= limit → new orders should be blocked
  nearLimit: boolean; // used >= 80% of limit → warn the owner
};

/**
 * Pure limit math (no DB) — testable. Unlimited tiers always report
 * atLimit=false; the cap blocks the (limit+1)th order.
 */
export function limitStatusFor(tier: TierKey, used: number): OrderLimitStatus {
  const limit = TIERS[tier].orderLimit;
  if (limit === null) {
    return { tier, limit: null, used, remaining: null, atLimit: false, nearLimit: false };
  }
  return {
    tier,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    atLimit: used >= limit,
    nearLimit: used >= Math.floor(limit * 0.8),
  };
}

/**
 * Where a kitchen stands against its plan's monthly order allowance.
 */
export async function orderLimitStatus(business: {
  id: string;
  tier: TierKey;
}): Promise<OrderLimitStatus> {
  const used = await ordersThisMonth(business.id);
  return limitStatusFor(business.tier, used);
}

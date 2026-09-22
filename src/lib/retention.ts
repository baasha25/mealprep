// Retention emails — abandoned-checkout nudges and win-back messages. The pure
// timing rules live in insights.ts (unit-tested); this runner does the DB reads
// and sends, and is called by the /api/cron/retention route. Idempotent via
// SentNotification (unique on type + target + date).

import { abandonedDue, winBackDue } from "@/lib/insights";

export type RetentionSummary = { scannedOrders: number; abandonedSent: number; scannedCustomers: number; winBackSent: number };

export async function runRetentionEmails(now: Date = new Date()): Promise<RetentionSummary> {
  const { db } = await import("@/lib/db");
  const { sendAbandonedCheckout, sendWinBack } = await import("@/lib/email");
  const { appUrl } = await import("@/lib/app-url");
  const { revenueStatusWhere } = await import("@/lib/order-status");
  const origin = await appUrl();
  const summary: RetentionSummary = { scannedOrders: 0, abandonedSent: 0, scannedCustomers: 0, winBackSent: 0 };

  const businesses = await db.business.findMany({
    where: { isDemo: false, slug: { not: null } },
    select: {
      id: true, name: true, brandColor: true, slug: true,
      settings: { select: { notifyAbandoned: true, notifyWinBack: true, winBackDays: true, winBackCouponCode: true } },
    },
  });
  const bizById = new Map(businesses.map((b) => [b.id, b]));

  // ── Abandoned checkouts: unpaid one-time/subscription orders, 2–48h old ──
  const abandonedBizIds = businesses.filter((b) => b.settings?.notifyAbandoned ?? true).map((b) => b.id);
  if (abandonedBizIds.length) {
    const orders = await db.order.findMany({
      where: {
        businessId: { in: abandonedBizIds },
        status: "pending",
        type: { in: ["one_time", "subscription"] },
        createdAt: { gte: new Date(now.getTime() - 48 * 3_600_000), lte: new Date(now.getTime() - 2 * 3_600_000) },
        customer: { isNot: null },
      },
      select: { id: true, businessId: true, createdAt: true, customer: { select: { name: true, email: true } }, items: { select: { nameSnapshot: true, qty: true } } },
    });
    summary.scannedOrders = orders.length;
    const already = new Set(
      (await db.sentNotification.findMany({ where: { type: "abandoned_checkout", targetId: { in: orders.map((o) => o.id) } }, select: { targetId: true } })).map((r) => r.targetId),
    );
    for (const o of orders) {
      const biz = bizById.get(o.businessId);
      if (!biz?.slug || !o.customer?.email || already.has(o.id)) continue;
      if (!abandonedDue(o.createdAt, null, now)) continue;
      try {
        await db.sentNotification.create({ data: { businessId: biz.id, type: "abandoned_checkout", targetId: o.id, forDate: "once" } });
      } catch {
        continue; // raced by another run
      }
      await sendAbandonedCheckout({
        to: o.customer.email,
        customerName: o.customer.name,
        businessName: biz.name,
        brandColor: biz.brandColor,
        storeUrl: `${origin}/store/${biz.slug}`,
        itemsSummary: o.items.map((i) => `${i.qty}× ${i.nameSnapshot}`).join(" · "),
      });
      summary.abandonedSent++;
    }
  }

  // ── Win-back: lapsed customers with no active plan ──
  for (const biz of businesses) {
    if (!biz.settings?.notifyWinBack || !biz.slug) continue;
    const days = biz.settings.winBackDays ?? 45;
    const lastPaid = await db.order.groupBy({
      by: ["customerId"],
      where: { businessId: biz.id, customerId: { not: null }, ...revenueStatusWhere },
      _max: { createdAt: true },
    });
    const lapsed = lastPaid
      .filter((r) => r.customerId && r._max.createdAt && now.getTime() - r._max.createdAt.getTime() >= days * 86_400_000)
      .sort((a, b) => (a._max.createdAt!.getTime() - b._max.createdAt!.getTime()))
      .slice(0, 100);
    summary.scannedCustomers += lapsed.length;
    if (lapsed.length === 0) continue;
    const ids = lapsed.map((r) => r.customerId as string);
    const [withPlan, sentRows, customers] = await Promise.all([
      db.subscription.findMany({ where: { businessId: biz.id, customerId: { in: ids }, status: { in: ["active", "paused"] } }, select: { customerId: true } }),
      db.sentNotification.findMany({ where: { type: "win_back", targetId: { in: ids } }, orderBy: { createdAt: "desc" }, select: { targetId: true, createdAt: true } }),
      db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }),
    ]);
    const hasPlan = new Set(withPlan.map((s) => s.customerId));
    const lastSent = new Map<string, Date>();
    for (const r of sentRows) if (!lastSent.has(r.targetId)) lastSent.set(r.targetId, r.createdAt);
    const lastPaidBy = new Map(lapsed.map((r) => [r.customerId as string, r._max.createdAt as Date]));

    for (const c of customers) {
      if (!c.email || hasPlan.has(c.id)) continue;
      if (!winBackDue(lastPaidBy.get(c.id) ?? null, lastSent.get(c.id) ?? null, now, days)) continue;
      try {
        await db.sentNotification.create({ data: { businessId: biz.id, type: "win_back", targetId: c.id, forDate: now.toISOString().slice(0, 10) } });
      } catch {
        continue;
      }
      await sendWinBack({
        to: c.email,
        customerName: c.name,
        businessName: biz.name,
        brandColor: biz.brandColor,
        storeUrl: `${origin}/store/${biz.slug}`,
        couponCode: biz.settings.winBackCouponCode,
        days,
      });
      summary.winBackSent++;
    }
  }

  return summary;
}

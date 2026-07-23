import { cutoffAt } from "@/lib/subscriptions";

// Scheduled customer reminders. The pure decision (dueReminders) is unit-tested;
// the runner does the DB reads + sends and is called by the daily cron route.

export type ReminderKind = "cutoff" | "delivery_day";

/** Stable YYYY-MM-DD key (UTC) — used both for de-dup and day comparison. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Which reminders are due for one subscription right now. De-duplication across
 * runs is handled by the caller (SentNotification), so this only decides timing.
 * - cutoff: "pick your meals" — fires once the ordering cut-off is within the
 *   next 48h (and not passed), UNLESS the subscriber has already picked meals
 *   for this delivery (no point nagging them).
 * - delivery_day: fires when the delivery is (UTC) today (regardless of picks).
 */
export function dueReminders(input: {
  now: Date;
  nextDeliveryDate: Date;
  notifyCutoff: boolean;
  notifyDeliveryDay: boolean;
  alreadyPicked?: boolean;
}): ReminderKind[] {
  const kinds: ReminderKind[] = [];
  if (input.notifyCutoff && !input.alreadyPicked) {
    const msToCutoff = cutoffAt(input.nextDeliveryDate).getTime() - input.now.getTime();
    if (msToCutoff > 0 && msToCutoff <= 48 * 3_600_000) kinds.push("cutoff");
  }
  if (input.notifyDeliveryDay && isoDate(input.now) === isoDate(input.nextDeliveryDate)) {
    kinds.push("delivery_day");
  }
  return kinds;
}

export type RunSummary = { scanned: number; cutoff: number; deliveryDay: number };

/** Scan active subscriptions and send any due reminders (idempotent per delivery). */
export async function runDailyNotifications(now: Date = new Date()): Promise<RunSummary> {
  // Lazy imports so dueReminders stays unit-testable without Prisma/email.
  const { db } = await import("@/lib/db");
  const { sendCutoffReminder, sendDeliveryDayReminder } = await import("@/lib/email");
  const { appUrl } = await import("@/lib/app-url");
  const origin = await appUrl();

  const subs = await db.subscription.findMany({
    where: { status: "active", nextDeliveryDate: { not: null } },
    select: {
      id: true,
      businessId: true,
      nextDeliveryDate: true,
      customer: { select: { name: true, email: true } },
      // Upcoming-ish selections so we can tell if they've already picked meals.
      selections: {
        where: { deliveryDate: { gte: new Date(now.getTime() - 24 * 3_600_000) } },
        select: { deliveryDate: true, _count: { select: { items: true } } },
      },
    },
  });

  const businessIds = [...new Set(subs.map((s) => s.businessId))];
  const businesses = await db.business.findMany({
    where: { id: { in: businessIds } },
    select: {
      id: true,
      name: true,
      brandColor: true,
      slug: true,
      settings: { select: { notifyCutoff: true, notifyDeliveryDay: true } },
    },
  });
  const bizById = new Map(businesses.map((b) => [b.id, b]));

  // Pre-load already-sent keys so we skip in-memory instead of relying on the
  // unique-constraint to reject a duplicate create (which logs a prisma error).
  const already = await db.sentNotification.findMany({
    where: { targetId: { in: subs.map((s) => s.id) } },
    select: { type: true, targetId: true, forDate: true },
  });
  const sentKeys = new Set(already.map((r) => `${r.type}:${r.targetId}:${r.forDate}`));

  const summary: RunSummary = { scanned: subs.length, cutoff: 0, deliveryDay: 0 };

  for (const sub of subs) {
    if (!sub.nextDeliveryDate || !sub.customer?.email) continue;
    const biz = bizById.get(sub.businessId);
    if (!biz?.slug) continue;

    // Already picked = a selection with items exists for this exact delivery.
    const alreadyPicked = sub.selections.some(
      (s) => s._count.items > 0 && s.deliveryDate.getTime() === sub.nextDeliveryDate!.getTime(),
    );

    const kinds = dueReminders({
      now,
      nextDeliveryDate: sub.nextDeliveryDate,
      notifyCutoff: biz.settings?.notifyCutoff ?? true,
      notifyDeliveryDay: biz.settings?.notifyDeliveryDay ?? true,
      alreadyPicked,
    });
    if (kinds.length === 0) continue;

    const forDate = isoDate(sub.nextDeliveryDate);
    const deliveryLabel = sub.nextDeliveryDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    const accountUrl = `${origin}/store/${biz.slug}/account`;
    const base = {
      to: sub.customer.email,
      customerName: sub.customer.name,
      businessName: biz.name,
      brandColor: biz.brandColor,
      deliveryLabel,
      accountUrl,
    };

    for (const kind of kinds) {
      // Idempotency: skip if we've already logged this reminder. The create is
      // still wrapped as a race backstop (the unique index is the source of truth).
      const key = `${kind}:${sub.id}:${forDate}`;
      if (sentKeys.has(key)) continue;
      try {
        await db.sentNotification.create({
          data: { businessId: biz.id, type: kind, targetId: sub.id, forDate },
        });
      } catch {
        continue;
      }
      sentKeys.add(key);
      if (kind === "cutoff") {
        await sendCutoffReminder(base);
        summary.cutoff++;
      } else {
        await sendDeliveryDayReminder(base);
        summary.deliveryDay++;
      }
    }
  }

  return summary;
}

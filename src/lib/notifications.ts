import { cutoffAt, deliveryLockAt } from "@/lib/subscriptions";

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
  /** When this delivery's picks lock (the kitchen's weekly cut-off); default 48h before. */
  lockAt?: Date;
}): ReminderKind[] {
  const kinds: ReminderKind[] = [];
  if (input.notifyCutoff && !input.alreadyPicked) {
    const msToCutoff = (input.lockAt ?? cutoffAt(input.nextDeliveryDate)).getTime() - input.now.getTime();
    if (msToCutoff > 0 && msToCutoff <= 48 * 3_600_000) kinds.push("cutoff");
  }
  if (input.notifyDeliveryDay && isoDate(input.now) === isoDate(input.nextDeliveryDate)) {
    kinds.push("delivery_day");
  }
  return kinds;
}

export type RunSummary = { scanned: number; cutoff: number; deliveryDay: number; sms: number; push: number };

/** Scan active subscriptions and send any due reminders (idempotent per delivery). */
export async function runDailyNotifications(now: Date = new Date()): Promise<RunSummary> {
  // Lazy imports so dueReminders stays unit-testable without Prisma/email.
  const { db } = await import("@/lib/db");
  const { sendCutoffReminder, sendDeliveryDayReminder } = await import("@/lib/email");
  const { SMS_ENABLED, sendSms, cutoffSmsBody } = await import("@/lib/sms");
  const { PUSH_ENABLED, sendPushToCustomer } = await import("@/lib/push");
  const { appUrl } = await import("@/lib/app-url");
  const origin = await appUrl();

  const subs = await db.subscription.findMany({
    where: { status: "active", nextDeliveryDate: { not: null } },
    select: {
      id: true,
      businessId: true,
      nextDeliveryDate: true,
      customer: { select: { id: true, name: true, email: true, phone: true, smsOptIn: true } },
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
      settings: { select: { notifyCutoff: true, notifyDeliveryDay: true, notifyCutoffSms: true, notifyPush: true, smsMonthlyCap: true, cutoff: true, timezone: true } },
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

  // SMS cost guard: texts already sent this calendar month, per kitchen.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const smsCounts = new Map<string, number>();
  if (SMS_ENABLED) {
    const rows = await db.sentNotification.groupBy({ by: ["businessId"], where: { type: { startsWith: "cutoff_sms" }, createdAt: { gte: monthStart } }, _count: { _all: true } });
    for (const r of rows) smsCounts.set(r.businessId, r._count._all);
  }

  const summary: RunSummary = { scanned: subs.length, cutoff: 0, deliveryDay: 0, sms: 0, push: 0 };

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
      lockAt: deliveryLockAt(sub.nextDeliveryDate, biz.settings ? { cutoff: biz.settings.cutoff, timezone: biz.settings.timezone } : null),
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
      businessId: biz.id,
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
      // Same moment, other channels: a push to any browser they allowed.
      if (PUSH_ENABLED && (biz.settings?.notifyPush ?? true) && sub.customer.id) {
        const n = await sendPushToCustomer(sub.customer.id, {
          title: kind === "cutoff" ? `Pick your meals for ${deliveryLabel}` : `Your meals arrive today`,
          body: kind === "cutoff" ? `${biz.name}: picks lock soon. Choose or change your meals.` : `${biz.name} is on its way.`,
          url: accountUrl,
          tag: `${kind}-${forDate}`,
        });
        summary.push += n;
      }
    }

    // Cut-off texts (opted-in subscribers only): "2 days" when the lock is 24–48h
    // out, "today" when it is within 24h. Daily run, so each fires at most once.
    if (SMS_ENABLED && biz.settings?.notifyCutoffSms && sub.customer.smsOptIn && sub.customer.phone && !alreadyPicked) {
      const lock = deliveryLockAt(sub.nextDeliveryDate, biz.settings ? { cutoff: biz.settings.cutoff, timezone: biz.settings.timezone } : null);
      const msLeft = lock.getTime() - now.getTime();
      const smsKind = msLeft > 0 && msLeft <= 24 * 3_600_000 ? "cutoff_sms_today" : msLeft > 24 * 3_600_000 && msLeft <= 48 * 3_600_000 ? "cutoff_sms_2d" : null;
      if (smsKind) {
        const key = `${smsKind}:${sub.id}:${forDate}`;
        const used = smsCounts.get(biz.id) ?? 0;
        if (!sentKeys.has(key) && used < (biz.settings.smsMonthlyCap ?? 500)) {
          try {
            await db.sentNotification.create({ data: { businessId: biz.id, type: smsKind, targetId: sub.id, forDate } });
            sentKeys.add(key);
            smsCounts.set(biz.id, used + 1);
            const sid = await sendSms(sub.customer.phone, cutoffSmsBody({ businessName: biz.name, deliveryLabel, hoursLeft: smsKind === "cutoff_sms_today" ? 6 : 48, accountUrl }));
            if (sid) summary.sms++;
          } catch {
            /* duplicate key race: already sent */
          }
        }
      }
    }
  }

  return summary;
}

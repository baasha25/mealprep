// Daily: remind unpaid kitchens that their free trial is ending (5 days out,
// last day, just after). Each step is sent at most once per kitchen
// (SentNotification type = step, targetId = businessId). Demo, comped and
// subscribed kitchens are never emailed.
import { db } from "@/lib/db";
import { sendTrialReminder } from "@/lib/email";
import { trialEmailStep, trialStatus } from "@/lib/trial";
import { TIERS, isTierKey } from "@/lib/tiers";
import { formatCents } from "@/lib/money";

export type TrialEmailSummary = { scanned: number; sent: number; skipped: number };

export async function runTrialEmails(now: Date = new Date()): Promise<TrialEmailSummary> {
  const since = new Date(now.getTime() - 4 * 86_400_000);
  const soon = new Date(now.getTime() + 6 * 86_400_000);
  const kitchens = await db.business.findMany({
    where: { isDemo: false, billingComped: false, billingStatus: { in: ["none", "canceled"] }, billingSubscriptionId: null, trialEndsAt: { gte: since, lte: soon } },
    select: { id: true, name: true, tier: true, trialEndsAt: true, currency: true, users: { where: { role: "owner" }, select: { email: true }, take: 1 } },
  });
  const summary: TrialEmailSummary = { scanned: kitchens.length, sent: 0, skipped: 0 };
  const already = new Set(
    (await db.sentNotification.findMany({ where: { type: { startsWith: "trial_" }, targetId: { in: kitchens.map((k) => k.id) } }, select: { type: true, targetId: true } })).map((r) => `${r.type}:${r.targetId}`),
  );
  for (const k of kitchens) {
    const step = trialEmailStep(k.trialEndsAt, now);
    const to = k.users[0]?.email;
    if (!step || !to || !k.trialEndsAt || already.has(`${step}:${k.id}`)) { summary.skipped++; continue; }
    try {
      await db.sentNotification.create({ data: { businessId: k.id, type: step, targetId: k.id, forDate: "once" } });
    } catch {
      summary.skipped++; continue; // already sent (or raced)
    }
    const tier = isTierKey(k.tier) ? TIERS[k.tier] : TIERS.starter;
    await sendTrialReminder({
      to,
      businessName: k.name,
      step,
      endsAt: k.trialEndsAt,
      planName: tier.name,
      planPriceLabel: `${formatCents(tier.priceCents)} ${k.currency === "USD" ? "USD" : "CAD"}`,
      daysLeft: trialStatus(k.trialEndsAt, now).daysLeft,
    });
    summary.sent++;
  }
  return summary;
}

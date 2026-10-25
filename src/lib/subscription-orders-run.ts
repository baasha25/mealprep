// Subscription deliveries → orders: the server-side runner. See
// subscription-orders.ts for the pure decisions it is built on. Server only
// (Prisma + email) — never import this from a client component.

import { currentCycleDeliveries, DEFAULT_TIMEZONE } from "@/lib/cutoff";
import type { ZoneLike } from "@/lib/zones";
import { dueDeliveryDates, autoPickItems, subscriptionOrderTotals, extrasForDelivery, parseNoPick, type NoPickBehaviour, type PickItem } from "@/lib/subscription-orders";

export type MaterializeSummary = { scanned: number; created: number; chefChoice: number; skippedNoPick: number; extrasBilled: number; errors: number };

/**
 * Create the orders for every subscription delivery whose cut-off has passed.
 * Safe to run any time (idempotent per subscription + delivery date). Pass a
 * businessId to limit the scan to one kitchen (the lazy page-load trigger).
 */
export async function materializeSubscriptionOrders(opts: { now?: Date; businessId?: string } = {}): Promise<MaterializeSummary> {
  const now = opts.now ?? new Date();
  // Lazy imports keep this module cheap to load from pages that rarely need it.
  const { db } = await import("@/lib/db");
  const { sendOrderConfirmation } = await import("@/lib/email");
  const { stripe, STRIPE_ENABLED, PLATFORM_CURRENCY } = await import("@/lib/stripe");

  // Bill extras on the next plan payment: one Stripe invoice item per order,
  // idempotent on the order id. Returns the invoice item id, or null on failure
  // (the next run retries any unbilled order — see the sweep at the end).
  const billExtras = async (o: { id: string; extrasCount: number; extrasCents: number; deliveryDate: Date | null }, sub: { stripeSubscriptionId: string | null; customer: { stripeCustomerId: string | null } | null }): Promise<string | null> => {
    if (!STRIPE_ENABLED || !sub.stripeSubscriptionId || o.extrasCents <= 0) return null;
    try {
      let customer = sub.customer?.stripeCustomerId ?? null;
      if (!customer) {
        const ss = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        customer = typeof ss.customer === "string" ? ss.customer : ss.customer.id;
      }
      const when = o.deliveryDate ? o.deliveryDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
      const item = await stripe.invoiceItems.create(
        {
          customer,
          subscription: sub.stripeSubscriptionId,
          currency: PLATFORM_CURRENCY,
          amount: o.extrasCents,
          description: `${o.extrasCount} extra meal${o.extrasCount === 1 ? "" : "s"}${when ? ` · ${when}` : ""}`,
          metadata: { orderId: o.id, kind: "subscription_extras" },
        },
        { idempotencyKey: `extras-${o.id}` },
      );
      await db.order.update({ where: { id: o.id }, data: { stripeInvoiceItemId: item.id } });
      summary.extrasBilled++;
      return item.id;
    } catch (err) {
      console.error(`[subscription-orders] extras billing failed for order ${o.id}:`, err);
      return null;
    }
  };
  const { enabledDeliveryDays, sanitizePreferredDays } = await import("@/lib/delivery-days");
  const { zoneForPostal, zoneDays, kitchenDaysWithZones } = await import("@/lib/zones");
  const { picksFromSnapshot, nameWithOptions } = await import("@/lib/meal-options");

  const summary: MaterializeSummary = { scanned: 0, created: 0, chefChoice: 0, skippedNoPick: 0, extrasBilled: 0, errors: 0 };
  const fortnightAgo = new Date(now.getTime() - 14 * 86_400_000);
  const historyFrom = new Date(now.getTime() - 90 * 86_400_000); // auto-pick draws from this window

  const subs = await db.subscription.findMany({
    where: { status: "active", nextDeliveryDate: { not: null }, ...(opts.businessId ? { businessId: opts.businessId } : {}) },
    include: {
      plan: { select: { mealsPerWeek: true, perMealPriceCents: true } },
      customer: { select: { id: true, name: true, email: true, stripeCustomerId: true, addresses: { orderBy: { id: "asc" }, take: 1 } } },
      selections: {
        where: { deliveryDate: { gte: historyFrom } },
        orderBy: { deliveryDate: "asc" },
        include: { items: { include: { meal: { select: { name: true, active: true } } } } },
      },
      orders: {
        where: { deliveryDate: { gte: historyFrom } },
        select: { deliveryDate: true, extrasCount: true, items: { select: { qty: true, mealId: true, optionsSnapshot: true, optionsKey: true, meal: { select: { active: true } } } } },
      },
    },
  });
  summary.scanned = subs.length;
  if (!subs.length) return summary;

  // Per-kitchen context, loaded once.
  type Ctx = {
    tz: string;
    kitchenDays: Record<string, boolean>;
    zones: ZoneLike[];
    noPick: NoPickBehaviour;
    fulfillment: string;
    goTo: string[] | null; // lazily loaded chef's-choice fallback
  };
  const ctxById = new Map<string, Ctx>();
  const ctxFor = async (businessId: string): Promise<Ctx> => {
    const hit = ctxById.get(businessId);
    if (hit) return hit;
    const [settings, zoneRows] = await Promise.all([
      db.businessSettings.findUnique({ where: { businessId }, select: { timezone: true, deliveryDays: true, subNoPick: true, fulfillment: true } }),
      db.deliveryZone.findMany({ where: { businessId, active: true } }),
    ]);
    const zones: ZoneLike[] = zoneRows.map((z) => ({ ...z, deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean> }));
    const ctx: Ctx = {
      tz: settings?.timezone || DEFAULT_TIMEZONE,
      kitchenDays: kitchenDaysWithZones((settings?.deliveryDays ?? {}) as Record<string, boolean>, zones),
      zones,
      noPick: parseNoPick(settings?.subNoPick),
      fulfillment: settings?.fulfillment ?? "both",
      goTo: null,
    };
    ctxById.set(businessId, ctx);
    return ctx;
  };
  // Chef's choice fallback: the kitchen's most-ordered active meals (else its first active meals).
  const goToFor = async (businessId: string, ctx: Ctx): Promise<string[]> => {
    if (ctx.goTo) return ctx.goTo;
    const active = await db.meal.findMany({ where: { businessId, active: true, isAddOn: false }, select: { id: true }, orderBy: { createdAt: "asc" }, take: 40 });
    const activeIds = new Set(active.map((m) => m.id));
    const top = await db.orderItem.groupBy({
      by: ["mealId"],
      where: { order: { businessId }, mealId: { in: [...activeIds] } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 6,
    });
    const ids = top.map((t) => t.mealId).filter((id): id is string => Boolean(id));
    ctx.goTo = ids.length >= 3 ? ids : [...new Set([...ids, ...active.map((m) => m.id)])].slice(0, 6);
    return ctx.goTo;
  };

  for (const sub of subs) {
    if (!sub.nextDeliveryDate) continue;
    try {
      const ctx = await ctxFor(sub.businessId);
      const addr = sub.customer?.addresses?.[0] ?? null;
      const postal = sub.postalCode ?? addr?.postalCode ?? null;
      const zone = zoneForPostal(postal, ctx.zones);
      const enabled = enabledDeliveryDays(zoneDays(zone, ctx.kitchenDays));
      const chosen = sanitizePreferredDays(sub.preferredDeliveryDays, enabled);
      const days = chosen.length ? chosen : enabled;
      const cycle = currentCycleDeliveries(days, sub.nextDeliveryDate, ctx.tz);
      const due = dueDeliveryDates({
        now,
        nextDeliveryDate: sub.nextDeliveryDate,
        chosenDays: days,
        tz: ctx.tz,
        existing: sub.orders.map((o) => o.deliveryDate).filter((d): d is Date => Boolean(d)),
      });
      if (!due.length) continue;
      const feeDate = cycle[0]?.getTime();

      for (const date of due) {
        const sel = sub.selections.find((s) => s.deliveryDate.getTime() === date.getTime());
        let items: PickItem[] = (sel?.items ?? [])
          .filter((i) => i.meal?.active !== false)
          .map((i) => ({ mealId: i.mealId, qty: i.qty, optionsSnapshot: i.optionsSnapshot ?? undefined, optionsKey: i.optionsKey }));
        let chef = false;
        if (!items.length) {
          if (ctx.noPick === "skip") {
            summary.skippedNoPick++;
            continue;
          }
          // Their history: everything they received (orders) plus picks not yet
          // turned into orders, active meals only. Favourites weigh more.
          const history: PickItem[] = [];
          for (const o of sub.orders) {
            if (!o.deliveryDate || o.deliveryDate.getTime() >= date.getTime()) continue;
            for (const i of o.items) if (i.mealId && i.meal?.active !== false) history.push({ mealId: i.mealId, qty: i.qty, optionsSnapshot: i.optionsSnapshot ?? undefined, optionsKey: i.optionsKey });
          }
          const orderedDates = new Set(sub.orders.map((o) => o.deliveryDate?.getTime()));
          for (const sl of sub.selections) {
            if (sl.deliveryDate.getTime() >= date.getTime() || orderedDates.has(sl.deliveryDate.getTime())) continue;
            for (const i of sl.items) if (i.meal?.active !== false) history.push({ mealId: i.mealId, qty: i.qty, optionsSnapshot: i.optionsSnapshot ?? undefined, optionsKey: i.optionsKey });
          }
          items = autoPickItems({
            mealsPerWeek: sub.plan.mealsPerWeek,
            history,
            fallbackMealIds: history.length ? [] : await goToFor(sub.businessId, ctx),
          });
          if (!items.length) {
            summary.skippedNoPick++;
            continue;
          }
          chef = true;
        }

        const mealRows = await db.meal.findMany({ where: { id: { in: items.map((i) => i.mealId) }, businessId: sub.businessId }, select: { id: true, name: true } });
        const nameOf = new Map(mealRows.map((m) => [m.id, m.name]));
        const itemCount = items.reduce((s, i) => s + i.qty, 0);
        const totals = subscriptionOrderTotals({
          itemCount,
          perMealPriceCents: sub.plan.perMealPriceCents,
          deliveryFeeCents: date.getTime() === feeDate ? sub.deliveryFeeCents : 0,
        });
        // Extras beyond the plan (across this cycle's deliveries), at the plan's per-meal price.
        const earlier = sub.orders.filter((o) => o.deliveryDate && cycle.some((c) => c.getTime() === o.deliveryDate!.getTime()) && o.deliveryDate.getTime() < date.getTime());
        const extrasCount = chef
          ? 0
          : extrasForDelivery({
              planMeals: sub.plan.mealsPerWeek,
              pickedBefore: earlier.reduce((s, o) => s + o.items.reduce((x, i) => x + i.qty, 0), 0),
              billedBefore: earlier.reduce((s, o) => s + o.extrasCount, 0),
              pickedNow: itemCount,
            });
        const extrasCents = extrasCount * sub.plan.perMealPriceCents;
        const addressLine = addr ? [addr.line1, addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ") : null;
        try {
          const order = await db.order.create({
            data: {
              businessId: sub.businessId,
              customerId: sub.customerId,
              subscriptionId: sub.id,
              type: "subscription",
              status: "paid",
              fulfillment: ctx.fulfillment === "pickup" ? "pickup" : "delivery",
              address: addressLine,
              zone: sub.zone ?? zone?.name ?? addr?.zone ?? null,
              postalCode: postal,
              deliveryDate: date,
              subtotalCents: totals.subtotalCents,
              taxCents: totals.taxCents,
              feesCents: totals.feesCents,
              totalCents: totals.totalCents,
              extrasCount,
              extrasCents,
              items: {
                create: items.map((i) => ({
                  mealId: i.mealId,
                  qty: i.qty,
                  unitPriceCentsSnapshot: sub.plan.perMealPriceCents,
                  nameSnapshot: nameWithOptions(nameOf.get(i.mealId) ?? "Meal", picksFromSnapshot(i.optionsSnapshot)),
                  optionsSnapshot: i.optionsSnapshot === undefined ? undefined : (i.optionsSnapshot as object),
                  optionsKey: i.optionsKey ?? null,
                  addedVia: chef ? "chef_choice" : null,
                })),
              },
            },
            select: { id: true },
          });
          summary.created++;
          if (chef) summary.chefChoice++;
          if (extrasCents > 0) await billExtras({ id: order.id, extrasCount, extrasCents, deliveryDate: date }, sub);
          try {
            await sendOrderConfirmation(order.id);
          } catch (err) {
            console.error("[subscription-orders] confirmation email failed:", err);
          }
        } catch (err) {
          // Unique (subscriptionId, deliveryDate): another run got there first.
          if ((err as { code?: string })?.code === "P2002") continue;
          throw err;
        }
      }
    } catch (err) {
      summary.errors++;
      console.error(`[subscription-orders] subscription ${sub.id} failed:`, err);
    }
  }

  // Retry extras that didn't bill (Stripe hiccup) on recent subscription orders.
  const unbilled = await db.order.findMany({
    where: { type: "subscription", extrasCents: { gt: 0 }, stripeInvoiceItemId: null, createdAt: { gte: fortnightAgo }, ...(opts.businessId ? { businessId: opts.businessId } : {}) },
    select: { id: true, extrasCount: true, extrasCents: true, deliveryDate: true, subscription: { select: { stripeSubscriptionId: true, customer: { select: { stripeCustomerId: true } } } } },
    take: 50,
  });
  for (const o of unbilled) {
    if (o.subscription) await billExtras(o, o.subscription);
  }
  return summary;
}

// Lazy trigger for owner pages (Kitchen OS, Routes, Orders): keeps a kitchen's
// subscriber orders current even when no scheduler is configured. Throttled per
// kitchen per server instance so a busy dashboard doesn't rescan on every view.
const lastRun = new Map<string, number>();
export async function ensureSubscriptionOrders(businessId: string, minIntervalMs = 2 * 60_000): Promise<void> {
  const last = lastRun.get(businessId) ?? 0;
  if (Date.now() - last < minIntervalMs) return;
  lastRun.set(businessId, Date.now());
  try {
    await materializeSubscriptionOrders({ businessId });
  } catch (err) {
    console.error("[subscription-orders] lazy run failed:", err);
  }
}

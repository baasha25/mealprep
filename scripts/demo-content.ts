import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { stationFor } from "../src/lib/stations";

// Additive demo-content filler for a specific kitchen (by owner email). Layers
// customers, dated orders, subscriptions, marketing, and inventory activity on
// TOP of existing data so every dashboard tab looks populated for a demo video.
// - No deletes. Idempotency-guarded via a marker email domain.
// - Deterministic PRNG so re-runs (after cleanup) reproduce the same set.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL ?? "gobie.thina6@gmail.com";
const TAG = "demofill.greenleaf"; // marker domain on added customers

let _s = 20260715;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff), _s / 0x7fffffff);
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const rint = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const cents = (d: number) => Math.round(d * 100);
const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, rint(0, 59), 0, 0);
  return d;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const NAMES = [
  "Jordan Blake", "Sofia Nguyen", "Marcus Webb", "Elena Petrov", "Derek Chan",
  "Hannah Kim", "Luis Romero", "Grace O'Brien", "Amir Haddad", "Chloe Martin",
  "Ben Foster", "Nadia Rahman", "Ryan Cole", "Isabel Cruz",
];
const ZONES = ["North", "East", "West", "South", "Downtown"];
const STREETS = ["Cedar Ave", "Birch St", "Maple Crt", "Oak Lane", "Elm Blvd", "Pine Way", "Willow Rd", "Aspen Dr"];

async function main() {
  const owner = await db.user.findFirst({ where: { email: OWNER_EMAIL }, select: { businessId: true } });
  if (!owner) throw new Error(`No user with email ${OWNER_EMAIL}`);
  const businessId = owner.businessId;

  const already = await db.customer.count({ where: { businessId, email: { endsWith: `@${TAG}` } } });
  if (already > 0) {
    console.log(`Already filled — ${already} demo customers exist. Aborting to avoid duplicates.`);
    return;
  }

  // Feature unlock for the demo (invoice scan etc.).
  await db.business.update({ where: { id: businessId }, data: { tier: "pro" } });

  const meals = await db.meal.findMany({ where: { businessId }, select: { id: true, name: true, priceCents: true, diet: true } });
  const ingredients = await db.ingredient.findMany({ where: { businessId }, select: { id: true, name: true, unit: true, costPerUnitCents: true, stockQty: true } });
  const plans = await db.plan.findMany({ where: { businessId }, select: { id: true, mealsPerWeek: true, perMealPriceCents: true } });
  if (meals.length === 0 || plans.length === 0) throw new Error("Business has no meals/plans to build on.");

  // --- Customers ---------------------------------------------------------
  const newCustomerIds: string[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i];
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
    const zone = pick(ZONES);
    const c = await db.customer.create({
      data: {
        businessId,
        name,
        email: `${slug}@${TAG}`,
        loyaltyPoints: rint(0, 340),
        referralCode: `RF${1000 + i}${name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}`,
        addresses: { create: [{ line1: `${rint(10, 990)} ${pick(STREETS)}`, zone, label: "Home" }] },
      },
    });
    newCustomerIds.push(c.id);
  }
  // Also spread some orders onto existing customers.
  const existingCustomers = await db.customer.findMany({ where: { businessId }, select: { id: true }, take: 30 });
  const allCustomerIds = [...newCustomerIds, ...existingCustomers.map((c) => c.id)];

  // --- Orders (dated, mixed status) --------------------------------------
  type Bucket = { status: "paid" | "in_production" | "packed" | "out_for_delivery" | "fulfilled" | "canceled" | "refunded"; n: number; lo: number; hi: number };
  const BUCKETS: Bucket[] = [
    { status: "in_production", n: 5, lo: 0, hi: 2 },
    { status: "paid", n: 5, lo: 0, hi: 4 },
    { status: "packed", n: 2, lo: 0, hi: 1 },
    { status: "out_for_delivery", n: 3, lo: 0, hi: 1 },
    { status: "fulfilled", n: 34, lo: 5, hi: 120 },
    { status: "canceled", n: 2, lo: 10, hi: 90 },
    { status: "refunded", n: 2, lo: 10, hi: 90 },
  ];
  let orderCount = 0;
  for (const b of BUCKETS) {
    for (let i = 0; i < b.n; i++) {
      const nItems = rint(1, 4);
      const chosen = [...meals].sort(() => rnd() - 0.5).slice(0, nItems);
      const lineItems = chosen.map((m) => ({ mealId: m.id, qty: rint(1, 4), unitPriceCentsSnapshot: m.priceCents, nameSnapshot: m.name }));
      const subtotalCents = lineItems.reduce((s, li) => s + li.unitPriceCentsSnapshot * li.qty, 0);
      const taxCents = Math.round((subtotalCents * 800) / 10000);
      const fulfillment = rnd() < 0.72 ? "delivery" : "pickup";
      const feesCents = fulfillment === "delivery" ? cents(4.99) + cents(1.5) : cents(1.5);
      const createdAt = daysAgo(rint(b.lo, b.hi));
      const zone = pick(ZONES);
      const type = rnd() < 0.4 ? "subscription" : rnd() < 0.75 ? "one_time" : "pos";
      await db.order.create({
        data: {
          businessId,
          customerId: pick(allCustomerIds),
          type,
          status: b.status,
          fulfillment,
          address: fulfillment === "delivery" ? `${rint(10, 990)} ${pick(STREETS)}` : null,
          zone: fulfillment === "delivery" ? zone : null,
          deliveryDate: addDays(createdAt, 3),
          subtotalCents,
          taxCents,
          feesCents,
          totalCents: subtotalCents + taxCents + feesCents,
          createdAt,
          items: { create: lineItems },
        },
      });
      orderCount++;
    }
  }

  // --- Subscriptions (active for MRR + a couple canceled for churn) ------
  const nextDelivery = new Date();
  nextDelivery.setDate(nextDelivery.getDate() + 5);
  nextDelivery.setHours(18, 0, 0, 0);
  let activeSubs = 0;
  for (let i = 0; i < 6; i++) {
    const plan = pick(plans);
    const sub = await db.subscription.create({
      data: {
        businessId,
        customerId: newCustomerIds[i],
        planId: plan.id,
        status: "active",
        frequency: rnd() < 0.7 ? "weekly" : "biweekly",
        nextDeliveryDate: nextDelivery,
      },
    });
    const selMeals = [...meals].sort(() => rnd() - 0.5).slice(0, rint(2, 3));
    await db.subscriptionSelection.create({
      data: {
        subscriptionId: sub.id,
        deliveryDate: nextDelivery,
        items: { create: selMeals.map((m) => ({ mealId: m.id, qty: rint(1, 3) })) },
      },
    });
    activeSubs++;
  }
  for (let i = 6; i < 8; i++) {
    await db.subscription.create({
      data: { businessId, customerId: newCustomerIds[i], planId: pick(plans).id, status: "canceled", frequency: "weekly" },
    });
  }

  // --- Marketing: coupons + gift cards -----------------------------------
  for (const c of [
    { code: "SUMMER15", type: "percent" as const, value: 15 },
    { code: "LOYAL20", type: "percent" as const, value: 20 },
    { code: "BULK25", type: "percent" as const, value: 25 },
    { code: "TENOFF", type: "flat" as const, value: cents(10) },
  ]) {
    await db.coupon.upsert({ where: { businessId_code: { businessId, code: c.code } }, update: {}, create: { businessId, ...c } });
  }
  for (const g of [
    { code: "GIFT-D1A2", amountCents: cents(100), balanceCents: cents(65), recipientEmail: "gift1@email.com" },
    { code: "GIFT-K7M3", amountCents: cents(50), balanceCents: cents(50), recipientEmail: "gift2@email.com" },
    { code: "GIFT-P9Q4", amountCents: cents(150), balanceCents: cents(120), recipientEmail: "gift3@email.com" },
  ]) {
    await db.giftCard.upsert({ where: { businessId_code: { businessId, code: g.code } }, update: {}, create: { businessId, ...g } });
  }

  // --- Inventory: recent receipts + stock counts (waste variance) --------
  for (let i = 0; i < 8; i++) {
    const ing = pick(ingredients);
    const qty = rint(5, 40);
    await db.ingredientReceipt.create({
      data: {
        businessId,
        ingredientId: ing.id,
        qtyReceived: qty,
        unit: ing.unit,
        totalCostCents: qty * ing.costPerUnitCents,
        note: "Delivery",
        receivedAt: daysAgo(rint(1, 25)),
      },
    });
  }
  for (let i = 0; i < 6; i++) {
    const ing = ingredients[i % ingredients.length];
    const expected = Math.max(1, ing.stockQty);
    const counted = Math.round(expected * (0.86 + rnd() * 0.12) * 100) / 100; // small unexplained loss
    const varianceQty = Math.round((expected - counted) * 100) / 100;
    await db.stockCount.create({
      data: {
        businessId,
        ingredientId: ing.id,
        expectedQty: expected,
        countedQty: counted,
        varianceQty,
        varianceCents: Math.round(varianceQty * ing.costPerUnitCents),
        countedAt: daysAgo(rint(1, 20)),
      },
    });
  }

  // --- Kitchen display: a fuller ticket board ----------------------------
  const statuses = ["todo", "cooking", "done"] as const;
  for (let i = 0; i < 8; i++) {
    const m = pick(meals);
    await db.productionTicket.create({
      data: {
        businessId,
        mealId: m.id,
        mealName: m.name,
        station: stationFor(m.diet),
        qty: rint(2, 12),
        status: pick([...statuses]),
      },
    });
  }

  console.log(`Done. Business ${businessId} → +${NAMES.length} customers, +${orderCount} orders, +${activeSubs} active subs, +marketing/inventory/KDS. Tier set to Pro.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

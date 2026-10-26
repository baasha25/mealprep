// One-off: populate the dev "Greenleaf Kitchen" with ~3.5 months of realistic
// transactional data (customers, orders, subscriptions, waste, receipts, costs)
// so every dashboard screen shows rich numbers for screenshots.
// Run: npx tsx prisma/seed-3mo.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const DAYS = 112; // ~3.7 months
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));
const pick = <T>(arr: readonly T[]): T => arr[rint(0, arr.length - 1)];
const chance = (p: number) => Math.random() < p;

const FIRST = ["Maria","Dwayne","Priya","Tom","Aisha","Greg","Sara","Liam","Noor","Chen","Diego","Emma","Raj","Kofi","Ivan","Lucia","Omar","Hana","Ben","Zoe","Kavya","Marco","Nadia","Sean","Tara","Yuki","Andre","Bianca","Colin","Devi","Farah","Gino","Hugo","Iris","Jamal","Kim","Leo","Mona","Nate","Ola","Pia","Quinn","Rosa","Sam","Tia","Uma","Vik","Wes","Xena","Yara","Zaid"];
const LAST = ["Lopez","King","Sharma","Reyes","Bello","Park","Nolan","Chen","Ali","Ito","Costa","Blanc","Singh","Mensah","Petrov","Diaz","Haddad","Kim","Ford","Wu","Rao","Rossi","Aziz","Walsh","Byrne","Tan","Silva","Novak","Doyle","Kaur","Nasser","Conti","Reid","Frost","Osei"];
const ZONES = ["North","East","West","South"] as const;
const STREETS = ["Cedar Ave","Birch St","Lakeshore Rd","Maple Crt","Elm Blvd","Oak Lane","Pine Way","Willow Dr","Aspen Rd","Ash Cres"];

async function main() {
  const biz = await db.business.findFirst({ where: { name: "Greenleaf Kitchen" }, include: { settings: true } });
  if (!biz) throw new Error("Greenleaf Kitchen not found");
  const bid = biz.id;
  const taxBps = biz.settings?.taxRateBps ?? 800;
  const deliveryFee = biz.settings?.deliveryFeeCents ?? 499;
  const procFee = biz.settings?.processingFeeCents ?? 150;

  const meals = await db.meal.findMany({ where: { businessId: bid }, select: { id: true, name: true, priceCents: true } });
  const plans = await db.plan.findMany({ where: { businessId: bid }, select: { id: true, name: true } });
  const ingredients = await db.ingredient.findMany({ where: { businessId: bid }, select: { id: true, name: true, unit: true, costPerUnitCents: true } });

  console.log(`Seeding ${DAYS} days for ${biz.name} — ${meals.length} meals, ${plans.length} plans`);

  // ---- wipe existing transactional data (keep meals/plans/ingredients) ----
  await db.lossEvent.deleteMany({ where: { businessId: bid } });
  await db.ingredientReceipt.deleteMany({ where: { businessId: bid } });
  await db.productionTicket.deleteMany({ where: { businessId: bid } });
  await db.subscriptionSelection.deleteMany({ where: { subscription: { businessId: bid } } });
  await db.orderItem.deleteMany({ where: { order: { businessId: bid } } });
  await db.payment.deleteMany({ where: { order: { businessId: bid } } });
  await db.order.deleteMany({ where: { businessId: bid } });
  await db.subscription.deleteMany({ where: { businessId: bid } });
  await db.address.deleteMany({ where: { customer: { businessId: bid } } });
  await db.customer.deleteMany({ where: { businessId: bid } });
  await db.operatingCost.deleteMany({ where: { businessId: bid } });

  const start = new Date();
  start.setDate(start.getDate() - DAYS);
  start.setHours(9, 0, 0, 0);
  const dayMs = 86400000;

  // ---- customers ----
  const CUST_N = 54;
  const customers: { id: string; zone: string; addr: string }[] = [];
  const usedEmail = new Set<string>();
  for (let i = 0; i < CUST_N; i++) {
    const fn = pick(FIRST), ln = pick(LAST);
    let email = `${fn}.${ln}${i}`.toLowerCase() + "@email.com";
    while (usedEmail.has(email)) email = `${fn}.${ln}${rint(1, 999)}`.toLowerCase() + "@email.com";
    usedEmail.add(email);
    const zone = pick(ZONES);
    const addr = `${rint(10, 1990)} ${pick(STREETS)}`;
    const created = new Date(start.getTime() + rnd(0, DAYS * 0.6) * dayMs);
    const c = await db.customer.create({
      data: {
        businessId: bid, name: `${fn} ${ln}`, email,
        phone: `647-${rint(200,999)}-${rint(1000,9999)}`,
        loyaltyPoints: rint(0, 480),
        createdAt: created,
        addresses: { create: [{ label: "Home", line1: addr, city: "Toronto", region: "ON", zone }] },
      },
      select: { id: true },
    });
    customers.push({ id: c.id, zone, addr });
  }

  // ---- subscriptions (active/paused/canceled) ----
  const proPlan = plans.find((p) => p.name === "Pro") ?? plans[0];
  const subCustomers = customers.slice(0, 26);
  const nextDelivery = new Date(); nextDelivery.setDate(nextDelivery.getDate() + 4); nextDelivery.setHours(18, 0, 0, 0);
  const subByCustomer = new Map<string, string>();
  for (let i = 0; i < subCustomers.length; i++) {
    const c = subCustomers[i];
    const status = i < 20 ? "active" : i < 23 ? "paused" : "canceled";
    const plan = pick(plans);
    const sub = await db.subscription.create({
      data: {
        businessId: bid, customerId: c.id, planId: plan.id,
        status: status as "active" | "paused" | "canceled",
        frequency: chance(0.75) ? "weekly" : "biweekly",
        nextDeliveryDate: status === "active" ? nextDelivery : null,
        createdAt: new Date(start.getTime() + rnd(0, DAYS * 0.4) * dayMs),
      },
      select: { id: true },
    });
    if (status === "active") subByCustomer.set(c.id, sub.id);
  }

  // ---- orders across the whole window ----
  let orderCount = 0, revenueCents = 0;
  const soldByMeal = new Map<string, number>();
  for (let d = 0; d < DAYS; d++) {
    const dayDate = new Date(start.getTime() + d * dayMs);
    const dow = dayDate.getDay();
    const base = dow === 1 || dow === 3 || dow === 5 ? 8 : 4; // busier on delivery days
    const nOrders = rint(base - 2, base + 3);
    for (let o = 0; o < nOrders; o++) {
      const cust = pick(customers);
      const roll = Math.random();
      const type = roll < 0.55 ? "subscription" : roll < 0.85 ? "one_time" : "pos";
      const nItems = rint(2, 5);
      const items: { mealId: string; qty: number; unitPriceCentsSnapshot: number; nameSnapshot: string }[] = [];
      const chosen = new Set<string>();
      for (let k = 0; k < nItems; k++) {
        const m = pick(meals);
        if (chosen.has(m.id)) continue;
        chosen.add(m.id);
        const qty = rint(1, 3);
        items.push({ mealId: m.id, qty, unitPriceCentsSnapshot: m.priceCents, nameSnapshot: m.name });
        soldByMeal.set(m.id, (soldByMeal.get(m.id) ?? 0) + qty);
      }
      const subtotal = items.reduce((s, it) => s + it.qty * it.unitPriceCentsSnapshot, 0);
      const tax = Math.round((subtotal * taxBps) / 10000);
      const fulfillment = type === "pos" ? "pickup" : chance(0.85) ? "delivery" : "pickup";
      const fees = (fulfillment === "delivery" ? deliveryFee : 0) + procFee;
      const total = subtotal + tax + fees;
      // status: most earned; a few canceled/refunded
      const sRoll = Math.random();
      const status = sRoll < 0.9 ? "fulfilled" : sRoll < 0.95 ? "paid" : sRoll < 0.975 ? "canceled" : "refunded";
      const createdAt = new Date(dayDate.getTime() + rnd(8, 20) * 3600000);
      const deliveryDate = new Date(createdAt.getTime() + rnd(1, 4) * dayMs);
      await db.order.create({
        data: {
          businessId: bid, customerId: cust.id,
          subscriptionId: type === "subscription" ? subByCustomer.get(cust.id) ?? null : null,
          type: type as "subscription" | "one_time" | "pos",
          status: status as "fulfilled" | "paid" | "canceled" | "refunded",
          fulfillment: fulfillment as "delivery" | "pickup",
          address: fulfillment === "delivery" ? cust.addr : null,
          zone: fulfillment === "delivery" ? cust.zone : null,
          deliveryDate, subtotalCents: subtotal, taxCents: tax, feesCents: fees, totalCents: total,
          createdAt,
          items: { create: items },
        },
      });
      orderCount++;
      if (status === "fulfilled" || status === "paid") revenueCents += subtotal;
    }
  }

  // ---- ingredient receipts (cost history + a couple of price rises) ----
  for (const ing of ingredients) {
    const nRec = rint(2, 3);
    const baseCost = ing.costPerUnitCents || rint(20, 90);
    for (let r = 0; r < nRec; r++) {
      const receivedAt = new Date(start.getTime() + rnd(0, DAYS) * dayMs);
      const drift = 1 + (r === nRec - 1 && chance(0.35) ? rnd(0.05, 0.22) : rnd(-0.03, 0.05));
      const qty = rint(20, 120);
      const perUnit = Math.max(5, Math.round(baseCost * drift));
      await db.ingredientReceipt.create({
        data: { businessId: bid, ingredientId: ing.id, qtyReceived: qty, unit: ing.unit, totalCostCents: perUnit * qty, receivedAt },
      });
    }
  }

  // ---- loss events across the window ----
  const REASONS = ["spoilage","dropped_in_transit","order_error","pest","remake","expired","other"] as const;
  const nLoss = Math.round(DAYS / 3);
  for (let i = 0; i < nLoss; i++) {
    const createdAt = new Date(start.getTime() + rnd(0, DAYS) * dayMs);
    const asMeal = chance(0.6);
    const reason = pick(REASONS);
    if (asMeal) {
      const m = pick(meals);
      const qty = rint(1, 6);
      await db.lossEvent.create({ data: { businessId: bid, kind: "meal", reason: reason as typeof REASONS[number], mealId: m.id, itemName: m.name, qty, costCents: rint(400, 3200), createdAt } });
    } else {
      const ing = pick(ingredients);
      await db.lossEvent.create({ data: { businessId: bid, kind: "ingredient", reason: reason as typeof REASONS[number], ingredientId: ing.id, itemName: ing.name, qty: rint(1, 20), unit: ing.unit, costCents: rint(300, 2600), createdAt } });
    }
  }

  // ---- production tickets for the current run ----
  const topMeals = [...soldByMeal.entries()].sort((a, b) => b[1] - a[1]);
  for (const [mealId, ] of topMeals) {
    const m = meals.find((x) => x.id === mealId)!;
    await db.productionTicket.create({ data: { businessId: bid, mealId, mealName: m.name, station: chance(0.5) ? "Grill" : "Cold Line", qty: rint(18, 52), status: pick(["todo","cooking","done"] as const) } });
  }

  // ---- operating costs (labour + overhead) ----
  await db.operatingCost.createMany({ data: [
    { businessId: bid, label: "Kitchen wages", category: "labor", monthlyCents: 260000 },
    { businessId: bid, label: "Part-time packer", category: "labor", monthlyCents: 70000 },
    { businessId: bid, label: "Commercial kitchen rent", category: "overhead", monthlyCents: 180000 },
    { businessId: bid, label: "Utilities", category: "overhead", monthlyCents: 42000 },
    { businessId: bid, label: "Insurance", category: "overhead", monthlyCents: 26000 },
    { businessId: bid, label: "Packaging & labels", category: "overhead", monthlyCents: 38000 },
  ]});

  console.log(`Done: ${customers.length} customers, ${orderCount} orders, ~$${(revenueCents/100).toLocaleString()} earned revenue over ${DAYS} days.`);
  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });

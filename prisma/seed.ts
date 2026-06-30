import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Money helpers — everything stored as integer cents / basis points.
const cents = (dollars: number) => Math.round(dollars * 100);
const bps = (fraction: number) => Math.round(fraction * 10000); // 0.12 -> 1200

// Ported from the Vite demo's INIT_MEALS / PLANS / COUPONS / SEED_ORDERS.
const MEALS = [
  {
    name: "Grilled Chicken & Quinoa", diet: "High Protein", price: 12.5, swatch: "#8a5a3c",
    desc: "Lean chicken, fluffy quinoa, roasted broccoli.",
    macros: { cal: 540, protein: 42, carbs: 48, fat: 16 }, allergens: [] as string[],
    ingredients: [
      { name: "Chicken breast", qty: 6, unit: "oz", trim: 0.12 },
      { name: "Quinoa", qty: 0.75, unit: "cup", trim: 0.02 },
      { name: "Broccoli", qty: 1, unit: "cup", trim: 0.18 },
      { name: "Olive oil", qty: 1, unit: "tbsp", trim: 0 },
    ],
  },
  {
    name: "Salmon & Sweet Potato", diet: "High Protein", price: 14.0, swatch: "#9a5142",
    desc: "Omega-rich salmon with roasted sweet potato.",
    macros: { cal: 610, protein: 38, carbs: 44, fat: 28 }, allergens: ["fish"],
    ingredients: [
      { name: "Salmon fillet", qty: 6, unit: "oz", trim: 0.1 },
      { name: "Sweet potato", qty: 1, unit: "ea", trim: 0.15 },
      { name: "Asparagus", qty: 1, unit: "cup", trim: 0.22 },
      { name: "Olive oil", qty: 1, unit: "tbsp", trim: 0 },
    ],
  },
  {
    name: "Vegan Buddha Bowl", diet: "Plant-Based", price: 11.0, swatch: "#5e6b4a",
    desc: "Chickpeas, brown rice, kale, tahini drizzle.",
    macros: { cal: 480, protein: 19, carbs: 62, fat: 18 }, allergens: ["nuts"],
    ingredients: [
      { name: "Chickpeas", qty: 0.75, unit: "cup", trim: 0.03 },
      { name: "Brown rice", qty: 0.75, unit: "cup", trim: 0.02 },
      { name: "Kale", qty: 1, unit: "cup", trim: 0.25 },
      { name: "Tahini", qty: 1, unit: "tbsp", trim: 0 },
    ],
  },
  {
    name: "Steak & Roasted Veg", diet: "Keto", price: 15.5, swatch: "#7a4a4a",
    desc: "Sirloin with brussels sprouts & sweet potato.",
    macros: { cal: 660, protein: 46, carbs: 30, fat: 38 }, allergens: [],
    ingredients: [
      { name: "Sirloin steak", qty: 6, unit: "oz", trim: 0.14 },
      { name: "Brussels sprouts", qty: 1, unit: "cup", trim: 0.2 },
      { name: "Sweet potato", qty: 1, unit: "ea", trim: 0.15 },
      { name: "Olive oil", qty: 1, unit: "tbsp", trim: 0 },
    ],
  },
  {
    name: "Turkey Meatballs & Zoodles", diet: "Low Carb", price: 12.0, swatch: "#6b5b3e",
    desc: "Turkey meatballs over zucchini noodles.",
    macros: { cal: 420, protein: 36, carbs: 18, fat: 22 }, allergens: ["dairy"],
    ingredients: [
      { name: "Ground turkey", qty: 5, unit: "oz", trim: 0.08 },
      { name: "Zucchini", qty: 2, unit: "ea", trim: 0.2 },
      { name: "Marinara", qty: 0.5, unit: "cup", trim: 0 },
      { name: "Parmesan", qty: 1, unit: "tbsp", trim: 0 },
    ],
  },
  {
    name: "Shrimp Cauli-Rice", diet: "Low Carb", price: 13.0, swatch: "#3f5c5a",
    desc: "Garlic shrimp over cauliflower fried rice.",
    macros: { cal: 390, protein: 32, carbs: 22, fat: 16 }, allergens: ["fish"],
    ingredients: [
      { name: "Shrimp", qty: 5, unit: "oz", trim: 0.1 },
      { name: "Cauliflower rice", qty: 1.5, unit: "cup", trim: 0.15 },
      { name: "Egg", qty: 1, unit: "ea", trim: 0 },
      { name: "Soy sauce", qty: 1, unit: "tbsp", trim: 0 },
    ],
  },
];

const PLANS = [
  { name: "Starter", meals: 5, perMeal: 11.5 },
  { name: "Pro", meals: 10, perMeal: 10.5 },
  { name: "Athlete", meals: 14, perMeal: 9.9 },
];

// Orders: customer + items keyed by meal name (mapped to created meal ids below).
const SEED_ORDERS = [
  { customer: "Maria Lopez", type: "subscription", items: { "Grilled Chicken & Quinoa": 3, "Vegan Buddha Bowl": 2 }, addr: "418 Cedar Ave", zone: "North" },
  { customer: "Dwayne King", type: "one_time", items: { "Steak & Roasted Veg": 4, "Salmon & Sweet Potato": 1 }, addr: "92 Birch St", zone: "North" },
  { customer: "Priya Sharma", type: "subscription", items: { "Vegan Buddha Bowl": 5 }, addr: "1200 Lakeshore Rd", zone: "East" },
  { customer: "Tom Reyes", type: "one_time", items: { "Grilled Chicken & Quinoa": 2, "Turkey Meatballs & Zoodles": 2, "Shrimp Cauli-Rice": 2 }, addr: "57 Maple Crt", zone: "East" },
  { customer: "Aisha Bello", type: "subscription", items: { "Salmon & Sweet Potato": 3, "Steak & Roasted Veg": 3 }, addr: "780 Elm Blvd", zone: "West" },
  { customer: "Greg Park", type: "one_time", items: { "Turkey Meatballs & Zoodles": 4, "Shrimp Cauli-Rice": 2 }, addr: "311 Oak Lane", zone: "West" },
] as const;

async function main() {
  console.log("Resetting seed business…");
  // Dev seed is a full reset. Delete subscriptions first: Subscription→Plan is a
  // required (restrict) relation, so the Business cascade would try to drop Plans
  // while subscriptions still reference them → FK violation. Clearing subscriptions
  // (cascades to selections/items) first avoids that ordering problem.
  await db.subscription.deleteMany({});
  await db.business.deleteMany({});

  const business = await db.business.create({
    data: {
      name: "Greenleaf Kitchen",
      brandColor: "#2f4536",
      settings: {
        create: {
          subDiscountBps: bps(0.15),
          deliveryFeeCents: cents(4.99),
          processingFeeCents: cents(1.5),
          taxRateBps: bps(0.08),
          minOrderCents: cents(35),
          minMeals: 3,
          platformFeeBps: bps(0.02), // 2% example platform fee — config, not final
          cutoff: "Sat 8:00 PM",
          fulfillment: "both",
          pickupLocations: ["Downtown Commissary", "Westside Pickup Hub"],
        },
      },
    },
  });
  console.log(`  business ${business.id}`);

  // Ingredients (dedup by name across meals).
  const ingredientNames = new Map<string, { unit: string; trim: number }>();
  for (const m of MEALS) {
    for (const ing of m.ingredients) {
      if (!ingredientNames.has(ing.name)) {
        ingredientNames.set(ing.name, { unit: ing.unit, trim: ing.trim });
      }
    }
  }
  // Purchase cost per the ingredient's recipe unit (dollars).
  const COST: Record<string, number> = {
    "Chicken breast": 0.3, Quinoa: 0.5, Broccoli: 0.4, "Olive oil": 0.15,
    "Salmon fillet": 0.75, "Sweet potato": 0.8, Asparagus: 0.9, Chickpeas: 0.45,
    "Brown rice": 0.3, Kale: 0.35, Tahini: 0.25, "Sirloin steak": 0.85,
    "Brussels sprouts": 0.5, "Ground turkey": 0.35, Zucchini: 0.6, Marinara: 0.7,
    Parmesan: 0.3, Shrimp: 0.8, "Cauliflower rice": 0.55, Egg: 0.25, "Soy sauce": 0.1,
  };
  const ingredientIds = new Map<string, string>();
  for (const [name, info] of ingredientNames) {
    const ing = await db.ingredient.create({
      data: {
        businessId: business.id,
        name,
        unit: info.unit,
        defaultTrimBps: bps(info.trim),
        costPerUnitCents: cents(COST[name] ?? 0),
      },
    });
    ingredientIds.set(name, ing.id);
  }
  console.log(`  ${ingredientIds.size} ingredients`);

  // Meals + recipe links.
  const mealIds = new Map<string, { id: string; priceCents: number }>();
  for (const m of MEALS) {
    const meal = await db.meal.create({
      data: {
        businessId: business.id,
        name: m.name,
        description: m.desc,
        diet: m.diet,
        priceCents: cents(m.price),
        swatch: m.swatch,
        calories: m.macros.cal,
        proteinG: m.macros.protein,
        carbsG: m.macros.carbs,
        fatG: m.macros.fat,
        allergens: m.allergens,
        ingredients: {
          create: m.ingredients.map((ing) => ({
            ingredientId: ingredientIds.get(ing.name)!,
            qty: ing.qty,
            unit: ing.unit,
            trimBps: bps(ing.trim),
          })),
        },
      },
    });
    mealIds.set(m.name, { id: meal.id, priceCents: cents(m.price) });
  }
  console.log(`  ${mealIds.size} meals`);

  // Plans.
  const planIds = new Map<string, string>();
  for (const p of PLANS) {
    const plan = await db.plan.create({
      data: {
        businessId: business.id,
        name: p.name,
        mealsPerWeek: p.meals,
        perMealPriceCents: cents(p.perMeal),
      },
    });
    planIds.set(p.name, plan.id);
  }
  const proPlanId = planIds.get("Pro")!;

  // Next delivery a few days out so subscriptions are editable before cut-off.
  const nextDelivery = new Date();
  nextDelivery.setDate(nextDelivery.getDate() + 5);
  nextDelivery.setHours(18, 0, 0, 0);

  // Coupons.
  await db.coupon.createMany({
    data: [
      { businessId: business.id, code: "FRESH10", type: "percent", value: 10 },
      { businessId: business.id, code: "WELCOME5", type: "flat", value: cents(5) },
    ],
  });

  // Gift cards.
  await db.giftCard.createMany({
    data: [
      { businessId: business.id, code: "GIFT-7K2P", amountCents: cents(75), balanceCents: cents(40), recipientEmail: "alex@email.com" },
      { businessId: business.id, code: "GIFT-9XR4", amountCents: cents(50), balanceCents: cents(50), recipientEmail: "sam@email.com" },
    ],
  });

  // Customers + orders (with price snapshots).
  const taxRateBps = 800;
  for (const o of SEED_ORDERS) {
    const email = `${o.customer.toLowerCase().replace(/[^a-z]+/g, ".")}@email.com`;
    const customer = await db.customer.create({
      data: {
        businessId: business.id,
        name: o.customer,
        email,
        addresses: { create: [{ line1: o.addr, zone: o.zone, label: "Home" }] },
      },
    });

    const lineItems = Object.entries(o.items).map(([mealName, qty]) => {
      const meal = mealIds.get(mealName)!;
      return { mealId: meal.id, qty, unitPriceCentsSnapshot: meal.priceCents, nameSnapshot: mealName };
    });
    const subtotalCents = lineItems.reduce((s, li) => s + li.unitPriceCentsSnapshot * li.qty, 0);
    const taxCents = Math.round((subtotalCents * taxRateBps) / 10000);
    const feesCents = cents(4.99) + cents(1.5);

    const order = await db.order.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        type: o.type,
        status: "paid",
        fulfillment: "delivery",
        address: o.addr,
        zone: o.zone,
        subtotalCents,
        taxCents,
        feesCents,
        totalCents: subtotalCents + taxCents + feesCents,
        items: { create: lineItems },
      },
    });

    // Subscription customers get an active recurring subscription with an
    // upcoming delivery selection (the meals on their seed order).
    if (o.type === "subscription") {
      const sub = await db.subscription.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          planId: proPlanId,
          status: "active",
          frequency: "weekly",
          nextDeliveryDate: nextDelivery,
        },
      });
      await db.subscriptionSelection.create({
        data: {
          subscriptionId: sub.id,
          deliveryDate: nextDelivery,
          items: {
            create: lineItems.map((li) => ({ mealId: li.mealId, qty: li.qty })),
          },
        },
      });
      // Link the seed order back to its subscription.
      await db.order.update({
        where: { id: order.id },
        data: { subscriptionId: sub.id },
      });
    }
  }
  console.log(`  ${SEED_ORDERS.length} customers + orders`);
  console.log("Seed complete.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

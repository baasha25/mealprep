import { db } from "@/lib/db";
import { referralCodeFrom } from "@/lib/loyalty";
import { stationFor } from "@/lib/stations";

// Stocks a freshly-created DEMO kitchen with a lean but FULLY-COSTED sample menu
// (recipes + ingredient costs), a few customers, and paid orders — so the money
// features (Profitability, Purchasing, Waste, Analytics) show real dollars the
// instant a rep enters the demo. Mirrors the "Greenleaf" sample used in the
// walkthrough screenshots so the live demo matches the deck. Runs on every demo
// entry (each session gets its own throwaway kitchen), so nothing to upload.

const cents = (d: number) => Math.round(d * 100);
const bps = (f: number) => Math.round(f * 10000);

const COST: Record<string, number> = {
  "Chicken breast": 0.3, Quinoa: 0.5, Broccoli: 0.4, "Olive oil": 0.15,
  "Salmon fillet": 0.75, "Sweet potato": 0.8, Asparagus: 0.9, Chickpeas: 0.45,
  "Brown rice": 0.3, Kale: 0.35, Tahini: 0.25, "Sirloin steak": 0.85,
  "Brussels sprouts": 0.5, "Ground turkey": 0.35, Zucchini: 0.6, Marinara: 0.7,
  Parmesan: 0.3, Shrimp: 0.8, "Cauliflower rice": 0.55, Egg: 0.25, "Soy sauce": 0.1,
};
const STOCK: Record<string, number> = { oz: 40, cup: 8, ea: 10, tbsp: 20, tsp: 20, lb: 6 };

// Meal photos: free, commercial-use Unsplash images, sized/cropped via Unsplash's
// own CDN params (robust + optimized, no hotlink-breakage). Makes the demo
// storefront + menu look real out of the gate. Swap for the merchant's own later.
const PHOTO = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&h=500&q=80`;

const MEALS = [
  { name: "Grilled Chicken & Quinoa", diet: "High Protein", price: 12.5, swatch: "#8a5a3c", img: PHOTO("photo-1522080213597-473dfd70215c"), desc: "Lean chicken, fluffy quinoa, roasted broccoli.", cal: 540, p: 42, c: 48, f: 16, allergens: [] as string[],
    ing: [["Chicken breast",6,"oz",0.12],["Quinoa",0.75,"cup",0.02],["Broccoli",1,"cup",0.18],["Olive oil",1,"tbsp",0]] },
  { name: "Salmon & Sweet Potato", diet: "High Protein", price: 14.0, swatch: "#9a5142", img: PHOTO("photo-1621362641986-999b4eb0f5ca"), desc: "Omega-rich salmon with roasted sweet potato.", cal: 610, p: 38, c: 44, f: 28, allergens: ["fish"],
    ing: [["Salmon fillet",6,"oz",0.1],["Sweet potato",1,"ea",0.15],["Asparagus",1,"cup",0.22],["Olive oil",1,"tbsp",0]] },
  { name: "Vegan Buddha Bowl", diet: "Plant-Based", price: 11.0, swatch: "#5e6b4a", img: PHOTO("photo-1505576633757-0ac1084af824"), desc: "Chickpeas, brown rice, kale, tahini drizzle.", cal: 480, p: 19, c: 62, f: 18, allergens: ["nuts"],
    ing: [["Chickpeas",0.75,"cup",0.03],["Brown rice",0.75,"cup",0.02],["Kale",1,"cup",0.25],["Tahini",1,"tbsp",0]] },
  { name: "Steak & Roasted Veg", diet: "Keto", price: 15.5, swatch: "#7a4a4a", img: PHOTO("photo-1604909054103-f9ed51a70caf"), desc: "Sirloin with brussels sprouts & sweet potato.", cal: 660, p: 46, c: 30, f: 38, allergens: [],
    ing: [["Sirloin steak",6,"oz",0.14],["Brussels sprouts",1,"cup",0.2],["Sweet potato",1,"ea",0.15],["Olive oil",1,"tbsp",0]] },
  { name: "Turkey Meatballs & Zoodles", diet: "Low Carb", price: 12.0, swatch: "#6b5b3e", img: PHOTO("photo-1720931782210-4ffd1f836b63"), desc: "Turkey meatballs over zucchini noodles.", cal: 420, p: 36, c: 18, f: 22, allergens: ["dairy"],
    ing: [["Ground turkey",5,"oz",0.08],["Zucchini",2,"ea",0.2],["Marinara",0.5,"cup",0],["Parmesan",1,"tbsp",0]] },
  { name: "Shrimp Cauli-Rice", diet: "Low Carb", price: 13.0, swatch: "#3f5c5a", img: PHOTO("photo-1685458696097-917ef0ec2239"), desc: "Garlic shrimp over cauliflower fried rice.", cal: 390, p: 32, c: 22, f: 16, allergens: ["fish"],
    ing: [["Shrimp",5,"oz",0.1],["Cauliflower rice",1.5,"cup",0.15],["Egg",1,"ea",0],["Soy sauce",1,"tbsp",0]] },
];

const PLANS = [ { name: "Starter", meals: 5, perMeal: 11.5 }, { name: "Pro", meals: 10, perMeal: 10.5 }, { name: "Athlete", meals: 14, perMeal: 9.9 } ];

// Monthly labour + overhead, sized to the demo's ~$428 of seeded sales so the
// Profitability page shows a healthy story: Prime Cost (food + labour) lands
// around the low-50s % (the ≤55% health line) and true operating profit is
// positive. Populates the Prime Cost hero + true-profit P&L out of the gate.
const OPERATING_COSTS = [
  { label: "Part-time prep help", category: "labor", monthly: 75 },
  { label: "Commissary kitchen rent", category: "overhead", monthly: 120 },
  { label: "Utilities", category: "overhead", monthly: 25 },
  { label: "Insurance", category: "overhead", monthly: 20 },
  { label: "Packaging & labels", category: "overhead", monthly: 15 },
] as const;

// A single recipe whose actual yield runs short of what it's costed for, so the
// demo shows the recipe-yield alert working (a real food-cost leak the tool catches).
const YIELD: Record<string, [expected: number, actual: number]> = {
  "Turkey Meatballs & Zoodles": [10, 9],
};

const ORDERS = [
  { cust: "Maria Lopez", type: "subscription", items: { "Grilled Chicken & Quinoa": 3, "Vegan Buddha Bowl": 2 }, addr: "418 Cedar Ave", zone: "North" },
  { cust: "Dwayne King", type: "one_time", items: { "Steak & Roasted Veg": 4, "Salmon & Sweet Potato": 1 }, addr: "92 Birch St", zone: "North" },
  { cust: "Priya Sharma", type: "subscription", items: { "Vegan Buddha Bowl": 5 }, addr: "1200 Lakeshore Rd", zone: "East" },
  { cust: "Tom Reyes", type: "one_time", items: { "Grilled Chicken & Quinoa": 2, "Turkey Meatballs & Zoodles": 2, "Shrimp Cauli-Rice": 2 }, addr: "57 Maple Crt", zone: "East" },
  { cust: "Aisha Bello", type: "subscription", items: { "Salmon & Sweet Potato": 3, "Steak & Roasted Veg": 3 }, addr: "780 Elm Blvd", zone: "West" },
  { cust: "Greg Park", type: "one_time", items: { "Turkey Meatballs & Zoodles": 4, "Shrimp Cauli-Rice": 2 }, addr: "311 Oak Lane", zone: "West" },
] as const;

/** Populate a demo kitchen with a fully-costed sample menu + orders. Best-effort. */
export async function seedDemoKitchen(businessId: string): Promise<void> {
  // Ingredients (costed) — id captured for recipe linking.
  const ingIds = new Map<string, string>();
  const ingNames = new Map<string, { unit: string; trim: number }>();
  for (const m of MEALS) for (const [name, , unit, trim] of m.ing) if (!ingNames.has(name as string)) ingNames.set(name as string, { unit: unit as string, trim: trim as number });
  for (const [name, info] of ingNames) {
    const ing = await db.ingredient.create({
      data: { businessId, name, unit: info.unit, defaultTrimBps: bps(info.trim), costPerUnitCents: cents(COST[name] ?? 0), stockQty: STOCK[info.unit] ?? 10 },
      select: { id: true },
    });
    ingIds.set(name, ing.id);
  }

  // Meals + recipes.
  const mealIds = new Map<string, { id: string; priceCents: number }>();
  for (const m of MEALS) {
    const meal = await db.meal.create({
      data: {
        businessId, name: m.name, description: m.desc, diet: m.diet, priceCents: cents(m.price), swatch: m.swatch, imageUrl: m.img,
        calories: m.cal, proteinG: m.p, carbsG: m.c, fatG: m.f, allergens: m.allergens,
        expectedServings: YIELD[m.name]?.[0] ?? null, actualServings: YIELD[m.name]?.[1] ?? null,
        ingredients: { create: m.ing.map(([name, qty, unit, trim]) => ({ ingredientId: ingIds.get(name as string)!, qty: qty as number, unit: unit as string, trimBps: bps(trim as number) })) },
      },
      select: { id: true },
    });
    mealIds.set(m.name, { id: meal.id, priceCents: cents(m.price) });
  }

  // Plans.
  const planIds = new Map<string, string>();
  for (const p of PLANS) {
    const plan = await db.plan.create({ data: { businessId, name: p.name, mealsPerWeek: p.meals, perMealPriceCents: cents(p.perMeal) }, select: { id: true } });
    planIds.set(p.name, plan.id);
  }
  const proPlanId = planIds.get("Pro")!;
  const nextDelivery = new Date();
  nextDelivery.setDate(nextDelivery.getDate() + 5);
  nextDelivery.setHours(18, 0, 0, 0);

  // Customers + paid orders (+ subscriptions for recurring ones).
  let idx = 0;
  for (const o of ORDERS) {
    idx++;
    const email = `${o.cust.toLowerCase().replace(/[^a-z]+/g, ".")}@email.com`;
    const customer = await db.customer.create({
      data: { businessId, name: o.cust, email, referralCode: referralCodeFrom(o.cust, idx), addresses: { create: [{ line1: o.addr, zone: o.zone, label: "Home" }] } },
      select: { id: true },
    });
    const items = Object.entries(o.items).map(([name, qty]) => { const meal = mealIds.get(name)!; return { mealId: meal.id, qty, unitPriceCentsSnapshot: meal.priceCents, nameSnapshot: name }; });
    const subtotal = items.reduce((s, li) => s + li.unitPriceCentsSnapshot * li.qty, 0);
    const tax = Math.round(subtotal * 0.08);
    const fees = cents(4.99) + cents(1.5);
    const order = await db.order.create({
      data: { businessId, customerId: customer.id, type: o.type, status: "paid", fulfillment: "delivery", address: o.addr, zone: o.zone, subtotalCents: subtotal, taxCents: tax, feesCents: fees, totalCents: subtotal + tax + fees, items: { create: items } },
      select: { id: true },
    });
    if (o.type === "subscription") {
      const sub = await db.subscription.create({ data: { businessId, customerId: customer.id, planId: proPlanId, status: "active", frequency: "weekly", nextDeliveryDate: nextDelivery }, select: { id: true } });
      await db.subscriptionSelection.create({ data: { subscriptionId: sub.id, deliveryDate: nextDelivery, items: { create: items.map((li) => ({ mealId: li.mealId, qty: li.qty })) } } });
      await db.order.update({ where: { id: order.id }, data: { subscriptionId: sub.id } });
    }
  }

  // Production tickets so Kitchen OS shows a run.
  const ticketQty = new Map<string, number>();
  for (const o of ORDERS) for (const [name, qty] of Object.entries(o.items)) ticketQty.set(name, (ticketQty.get(name) ?? 0) + qty);
  const mealDiet = new Map(MEALS.map((m) => [m.name, m.diet]));
  await db.productionTicket.createMany({
    data: [...ticketQty.entries()].map(([name, qty]) => ({ businessId, mealId: mealIds.get(name)!.id, mealName: name, station: stationFor(mealDiet.get(name)), qty, status: "todo" as const })),
  });

  // A couple of promotions so the Marketing screen isn't empty.
  await db.coupon.createMany({ data: [ { businessId, code: "FRESH10", type: "percent", value: 10 }, { businessId, code: "WELCOME5", type: "flat", value: cents(5) } ] });

  // Labour + overhead so Profitability shows Prime Cost and true profit populated.
  await db.operatingCost.createMany({
    data: OPERATING_COSTS.map((c) => ({ businessId, label: c.label, category: c.category, monthlyCents: cents(c.monthly) })),
  });
}

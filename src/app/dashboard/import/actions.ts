"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { dollarsToCents, percentToBps } from "@/lib/money";
import { parseCsvRecords, splitList } from "@/lib/csv";
import { DIET_OPTS, ALLERGENS, UNITS, swatchForIndex } from "@/lib/menu-constants";

export type ImportKind = "menu" | "customers" | "subscriptions" | "inventory";

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  // Non-blocking notices — the row still imported, but an optional field was missing.
  warnings: { row: number; message: string }[];
  message?: string;
};

const empty = (): ImportResult => ({ ok: true, created: 0, updated: 0, skipped: 0, errors: [], warnings: [] });

const DIET_SET = new Set<string>(DIET_OPTS);
const ALLERGEN_SET = new Set<string>(ALLERGENS);
const num = (v: string, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Dispatch by kind so the client can call one entry point. */
export async function runImport(kind: ImportKind, csvText: string): Promise<ImportResult> {
  switch (kind) {
    case "menu":
      return importMenu(csvText);
    case "customers":
      return importCustomers(csvText);
    case "subscriptions":
      return importSubscriptions(csvText);
    case "inventory":
      return importInventory(csvText);
    default:
      return { ...empty(), ok: false, message: "Unknown import type." };
  }
}

/* --------------------------------- Menu --------------------------------- */

const MenuRow = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  // Require a real price — blank must error, not silently coerce to $0.
  price: z
    .string()
    .trim()
    .min(1, "price is required")
    .transform((s) => Number(s))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100000, "price must be a number"),
});

async function importMenu(csvText: string): Promise<ImportResult> {
  const { business } = await requireBusiness();
  const records = parseCsvRecords(csvText);
  const result = empty();
  if (records.length === 0) return { ...result, ok: false, message: "No rows found. Include a header row." };

  let count = await db.meal.count({ where: { businessId: business.id } });

  for (let i = 0; i < records.length; i++) {
    const rowNo = i + 2; // +1 header, +1 to 1-index
    const rec = records[i];
    const parsed = MenuRow.safeParse({ name: rec.name, price: rec.price });
    if (!parsed.success) {
      result.skipped++;
      result.errors.push({ row: rowNo, message: parsed.error.issues[0]?.message ?? "invalid row" });
      continue;
    }
    // Optional fields — import anyway, but flag what's missing.
    if (!(rec.calories ?? "").trim()) {
      result.warnings.push({ row: rowNo, message: `${parsed.data.name}: no calories (optional)` });
    }

    const dietRaw = (rec.diet ?? "").trim();
    const diet = DIET_SET.has(dietRaw) ? dietRaw : null;
    const allergens = splitList(rec.allergens).filter((a) => ALLERGEN_SET.has(a));

    const data = {
      name: parsed.data.name,
      description: (rec.description ?? "").trim() || null,
      diet,
      priceCents: dollarsToCents(parsed.data.price),
      calories: Math.round(num(rec.calories)),
      proteinG: Math.round(num(rec.protein)),
      carbsG: Math.round(num(rec.carbs)),
      fatG: Math.round(num(rec.fat)),
      allergens,
    };

    const existing = await db.meal.findFirst({
      where: { businessId: business.id, name: parsed.data.name },
      select: { id: true },
    });
    if (existing) {
      await db.meal.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      await db.meal.create({
        data: { businessId: business.id, swatch: swatchForIndex(count++), active: true, ...data },
      });
      result.created++;
    }
  }

  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard");
  return result;
}

/* ------------------------------ Customers ------------------------------ */

const CustomerRow = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  email: z.string().trim().toLowerCase().email("valid email required"),
});

async function importCustomers(csvText: string): Promise<ImportResult> {
  const { business } = await requireBusiness();
  const records = parseCsvRecords(csvText);
  const result = empty();
  if (records.length === 0) return { ...result, ok: false, message: "No rows found. Include a header row." };

  for (let i = 0; i < records.length; i++) {
    const rowNo = i + 2;
    const rec = records[i];
    const parsed = CustomerRow.safeParse({ name: rec.name, email: rec.email });
    if (!parsed.success) {
      result.skipped++;
      result.errors.push({ row: rowNo, message: parsed.error.issues[0]?.message ?? "invalid row" });
      continue;
    }
    if (!(rec.phone ?? "").trim()) {
      result.warnings.push({ row: rowNo, message: `${parsed.data.name}: no phone number (optional)` });
    }

    const data = {
      name: parsed.data.name,
      phone: (rec.phone ?? "").trim() || null,
      dietaryPrefs: splitList(rec.dietaryprefs ?? rec["dietary prefs"]),
      allergens: splitList(rec.allergens).filter((a) => ALLERGEN_SET.has(a)),
    };

    const existing = await db.customer.findFirst({
      where: { businessId: business.id, email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      await db.customer.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      await db.customer.create({
        data: { businessId: business.id, email: parsed.data.email, ...data },
      });
      result.created++;
    }
  }

  revalidatePath("/dashboard");
  return result;
}

/* ------------------------------ Inventory ------------------------------ */
// Opening / standing inventory: what a switching kitchen ALREADY has on the
// shelf right now, priced. Sets the current stock level + cost directly (not a
// delivery), so margins, purchasing, waste, and P&L reflect reality from day one.

const UNIT_SET = new Set<string>(UNITS);

const InventoryRow = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  unit: z
    .string()
    .trim()
    .toLowerCase()
    .refine((u) => UNIT_SET.has(u), `unit must be one of: ${UNITS.join(", ")}`),
  quantity: z
    .string()
    .trim()
    .min(1, "quantity is required")
    .transform((s) => Number(s))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 1_000_000, "quantity must be a number"),
});

async function importInventory(csvText: string): Promise<ImportResult> {
  const { business } = await requireBusiness();
  const records = parseCsvRecords(csvText);
  const result = empty();
  if (records.length === 0) return { ...result, ok: false, message: "No rows found. Include a header row." };

  for (let i = 0; i < records.length; i++) {
    const rowNo = i + 2;
    const rec = records[i];
    const parsed = InventoryRow.safeParse({ name: rec.name, unit: rec.unit, quantity: rec.quantity });
    if (!parsed.success) {
      result.skipped++;
      result.errors.push({ row: rowNo, message: parsed.error.issues[0]?.message ?? "invalid row" });
      continue;
    }

    const costStr = (rec.cost ?? "").trim();
    const hasCost = costStr.length > 0 && Number.isFinite(Number(costStr));
    if (!hasCost) {
      result.warnings.push({ row: rowNo, message: `${parsed.data.name}: no cost — margins/P&L stay $0 until you price it` });
    }
    const trimStr = (rec.trim ?? "").trim();

    // Fields that are always set from an opening balance.
    const data: {
      unit: string;
      stockQty: number;
      costPerUnitCents?: number;
      defaultTrimBps?: number;
    } = { unit: parsed.data.unit, stockQty: parsed.data.quantity };
    if (hasCost) data.costPerUnitCents = dollarsToCents(Number(costStr));
    if (trimStr.length) data.defaultTrimBps = percentToBps(num(trimStr));

    const existing = await db.ingredient.findFirst({
      where: { businessId: business.id, name: parsed.data.name },
      select: { id: true },
    });
    if (existing) {
      await db.ingredient.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      await db.ingredient.create({
        data: {
          businessId: business.id,
          name: parsed.data.name,
          unit: data.unit,
          stockQty: data.stockQty,
          costPerUnitCents: data.costPerUnitCents ?? 0,
          defaultTrimBps: data.defaultTrimBps ?? 0,
        },
      });
      result.created++;
    }
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard");
  return result;
}

/* ----------------------------- Subscriptions ---------------------------- */

const SubRow = z.object({
  email: z.string().trim().toLowerCase().email("valid customer email required"),
  plan: z.string().trim().min(1, "plan is required"),
  frequency: z.enum(["weekly", "biweekly"]).optional().default("weekly"),
});

async function importSubscriptions(csvText: string): Promise<ImportResult> {
  const { business } = await requireBusiness();
  const records = parseCsvRecords(csvText);
  const result = empty();
  if (records.length === 0) return { ...result, ok: false, message: "No rows found. Include a header row." };

  const plans = await db.plan.findMany({ where: { businessId: business.id } });
  const planByName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), p]));

  for (let i = 0; i < records.length; i++) {
    const rowNo = i + 2;
    const rec = records[i];
    const parsed = SubRow.safeParse({ email: rec.email, plan: rec.plan, frequency: rec.frequency || undefined });
    if (!parsed.success) {
      result.skipped++;
      result.errors.push({ row: rowNo, message: parsed.error.issues[0]?.message ?? "invalid row" });
      continue;
    }
    const customer = await db.customer.findFirst({
      where: { businessId: business.id, email: parsed.data.email },
      select: { id: true },
    });
    if (!customer) {
      result.skipped++;
      result.errors.push({ row: rowNo, message: `no customer with email ${parsed.data.email} (import customers first)` });
      continue;
    }
    const plan = planByName.get(parsed.data.plan.toLowerCase());
    if (!plan) {
      result.skipped++;
      result.errors.push({ row: rowNo, message: `unknown plan "${parsed.data.plan}"` });
      continue;
    }

    const existing = await db.subscription.findFirst({
      where: { businessId: business.id, customerId: customer.id, status: { not: "canceled" } },
      select: { id: true },
    });
    if (existing) {
      await db.subscription.update({
        where: { id: existing.id },
        data: { planId: plan.id, frequency: parsed.data.frequency, status: "active" },
      });
      result.updated++;
    } else {
      await db.subscription.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          planId: plan.id,
          frequency: parsed.data.frequency,
          status: "active",
        },
      });
      result.created++;
    }
  }

  revalidatePath("/dashboard");
  return result;
}

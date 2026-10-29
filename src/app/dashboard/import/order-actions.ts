"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { swatchForIndex } from "@/lib/menu-constants";
import { ORDER_CHUNK_SIZE } from "@/lib/order-import";

// Order-history import (see src/lib/order-import.ts for the pure parsing).
// The browser parses and groups the file, then calls:
//   startOrderImport → importOrderChunk × N → finishOrderImport
// Every order carries importBatchId (one click undoes the upload) and the old
// system's order number as externalRef (re-importing the same file is a no-op).

const Line = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.number().int().min(1).max(10_000),
  unitPriceCents: z.number().int().min(0).max(10_000_000),
});

const Order = z.object({
  ref: z.string().trim().min(1).max(80),
  date: z.string().datetime(),
  // A bad address ("n/a") must not sink the whole chunk — it just becomes a guest order.
  email: z.string().trim().toLowerCase().email().nullable().catch(null),
  customerName: z.string().trim().max(120).nullable(),
  status: z.enum(["fulfilled", "paid", "canceled", "refunded"]),
  fulfillment: z.enum(["delivery", "pickup"]),
  type: z.enum(["one_time", "subscription"]),
  postalCode: z.string().trim().max(12).nullable(),
  items: z.array(Line).min(1).max(200),
  subtotalCents: z.number().int().min(0),
  taxCents: z.number().int().min(0),
  feesCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
});

const Chunk = z.array(Order).min(1).max(ORDER_CHUNK_SIZE);

export type OrderChunkResult = {
  created: number;
  skipped: number; // already imported (same order number)
  guests: number; // orders with no usable email → shown as Guest
  createdMeals: string[];
  createdCustomers: number;
  unmatchedMeals: string[]; // item names with no meal (and creation off)
  error?: string;
};

/** Which item names in the file have no meal in this kitchen's menu (case-insensitive). */
export async function matchMealNames(names: string[]): Promise<{ unmatched: string[] }> {
  const { business } = await requireBusiness();
  const wanted = z.array(z.string().trim().min(1).max(120)).max(3000).parse(names);
  const meals = await db.meal.findMany({ where: { businessId: business.id }, select: { name: true } });
  const have = new Set(meals.map((m) => m.name.trim().toLowerCase()));
  return { unmatched: wanted.filter((n) => !have.has(n.toLowerCase())) };
}

export async function startOrderImport(input: { fileName?: string | null; source: string; orderCount: number; lineCount: number }): Promise<{ batchId: string }> {
  const { business } = await requireBusiness();
  const data = z
    .object({
      fileName: z.string().trim().max(160).nullable().optional(),
      source: z.enum(["shopify", "woocommerce", "square", "generic"]),
      orderCount: z.number().int().min(0).max(100_000),
      lineCount: z.number().int().min(0).max(500_000),
    })
    .parse(input);
  const batch = await db.importBatch.create({
    data: { businessId: business.id, kind: "orders", fileName: data.fileName ?? null, source: data.source, orderCount: 0, lineCount: 0 },
    select: { id: true },
  });
  return { batchId: batch.id };
}

export async function importOrderChunk(batchId: string, rawOrders: unknown, opts: { createMissingMeals: boolean }): Promise<OrderChunkResult> {
  const { business } = await requireBusiness();
  const result: OrderChunkResult = { created: 0, skipped: 0, guests: 0, createdMeals: [], createdCustomers: 0, unmatchedMeals: [] };

  const batch = await db.importBatch.findFirst({ where: { id: batchId, businessId: business.id }, select: { id: true } });
  if (!batch) return { ...result, error: "This import no longer exists." };
  const parsed = Chunk.safeParse(rawOrders);
  if (!parsed.success) return { ...result, error: "Some rows could not be read: " + (parsed.error.issues[0]?.message ?? "invalid data") };
  const orders = parsed.data;

  // Already-imported order numbers (same file uploaded twice) are skipped, not duplicated.
  const refs = orders.map((o) => o.ref);
  const existing = await db.order.findMany({ where: { businessId: business.id, externalRef: { in: refs } }, select: { externalRef: true } });
  const seen = new Set(existing.map((e) => e.externalRef));

  // Meals by name; optionally create the ones the menu doesn't have yet (hidden
  // from the storefront) so P&L and menu engineering can still group by meal.
  const meals = await db.meal.findMany({ where: { businessId: business.id }, select: { id: true, name: true } });
  const mealByName = new Map(meals.map((m) => [m.name.trim().toLowerCase(), m.id]));
  let mealCount = meals.length;
  const unmatched = new Set<string>();

  // Customers by email; create the ones we don't know yet.
  const emails = Array.from(new Set(orders.map((o) => o.email).filter((e): e is string => !!e)));
  const customers = emails.length ? await db.customer.findMany({ where: { businessId: business.id, email: { in: emails } }, select: { id: true, email: true } }) : [];
  const customerByEmail = new Map(customers.map((c) => [c.email, c.id]));

  for (const o of orders) {
    if (seen.has(o.ref)) {
      result.skipped++;
      continue;
    }
    seen.add(o.ref);

    let customerId: string | null = null;
    if (o.email) {
      customerId = customerByEmail.get(o.email) ?? null;
      if (!customerId) {
        const c = await db.customer.create({
          data: { businessId: business.id, email: o.email, name: o.customerName || o.email.split("@")[0] },
          select: { id: true },
        });
        customerByEmail.set(o.email, c.id);
        customerId = c.id;
        result.createdCustomers++;
      }
    } else {
      result.guests++;
    }

    const items: { mealId: string | null; qty: number; unitPriceCentsSnapshot: number; nameSnapshot: string }[] = [];
    for (const line of o.items) {
      const key = line.name.toLowerCase();
      let mealId = mealByName.get(key) ?? null;
      if (!mealId && opts.createMissingMeals) {
        const m = await db.meal.create({
          data: { businessId: business.id, name: line.name, priceCents: line.unitPriceCents, active: false, swatch: swatchForIndex(mealCount++) },
          select: { id: true },
        });
        mealByName.set(key, m.id);
        mealId = m.id;
        result.createdMeals.push(line.name);
      }
      if (!mealId) unmatched.add(line.name);
      items.push({ mealId, qty: line.qty, unitPriceCentsSnapshot: line.unitPriceCents, nameSnapshot: line.name });
    }

    const when = new Date(o.date);
    await db.order.create({
      data: {
        businessId: business.id,
        customerId,
        type: o.type,
        status: o.status,
        fulfillment: o.fulfillment,
        postalCode: o.postalCode,
        deliveryDate: when,
        subtotalCents: o.subtotalCents,
        taxCents: o.taxCents,
        feesCents: o.feesCents,
        totalCents: o.totalCents,
        importBatchId: batch.id,
        externalRef: o.ref,
        createdAt: when,
        items: { create: items },
      },
      select: { id: true },
    });
    result.created++;
  }

  result.unmatchedMeals = Array.from(unmatched);
  return result;
}

export async function finishOrderImport(batchId: string): Promise<{ ok: boolean }> {
  const { business } = await requireBusiness();
  const batch = await db.importBatch.findFirst({ where: { id: batchId, businessId: business.id }, select: { id: true } });
  if (!batch) return { ok: false };
  const [agg, lines, sold] = await Promise.all([
    db.order.aggregate({ where: { importBatchId: batch.id }, _count: { _all: true }, _min: { createdAt: true }, _max: { createdAt: true } }),
    db.orderItem.count({ where: { order: { importBatchId: batch.id } } }),
    db.order.aggregate({ where: { importBatchId: batch.id, status: { notIn: ["canceled", "refunded"] } }, _sum: { totalCents: true } }),
  ]);
  // Same file uploaded twice: every order was skipped, so there is nothing to undo — drop the empty batch.
  if (agg._count._all === 0) {
    await db.importBatch.delete({ where: { id: batch.id } });
    revalidateAfterImport();
    return { ok: true };
  }
  await db.importBatch.update({
    where: { id: batch.id },
    data: {
      orderCount: agg._count._all,
      lineCount: lines,
      revenueCents: sold._sum.totalCents ?? 0,
      firstDate: agg._min.createdAt,
      lastDate: agg._max.createdAt,
    },
  });
  revalidateAfterImport();
  return { ok: true };
}

/** Undo one upload: deleting the batch cascades to every order it created. */
export async function deleteOrderImport(batchId: string): Promise<{ ok: boolean; removed: number }> {
  const { business } = await requireBusiness();
  const batch = await db.importBatch.findFirst({ where: { id: batchId, businessId: business.id }, select: { id: true, orderCount: true } });
  if (!batch) return { ok: false, removed: 0 };
  await db.importBatch.delete({ where: { id: batch.id } });
  revalidateAfterImport();
  return { ok: true, removed: batch.orderCount };
}

function revalidateAfterImport() {
  for (const p of ["/dashboard", "/dashboard/import", "/dashboard/orders", "/dashboard/analytics", "/dashboard/profitability", "/dashboard/customers", "/dashboard/menu", "/dashboard/reports"]) {
    revalidatePath(p);
  }
}

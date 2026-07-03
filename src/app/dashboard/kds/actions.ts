"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { stationFor } from "@/lib/stations";

const PRODUCING = ["paid", "in_production"] as const;

/**
 * Start (or restart) a production run: turn the current queue into line tickets,
 * one per meal batch, routed to its station. Replaces any existing tickets.
 */
export async function startProductionRun() {
  const { business } = await requireBusiness();

  const items = await db.orderItem.findMany({
    where: { order: { businessId: business.id, status: { in: [...PRODUCING] } }, mealId: { not: null } },
    select: { qty: true, mealId: true, nameSnapshot: true, meal: { select: { diet: true } } },
  });

  // Aggregate to one ticket per meal.
  const byMeal = new Map<string, { mealId: string; mealName: string; station: string; qty: number }>();
  for (const it of items) {
    const key = it.mealId ?? it.nameSnapshot;
    const cur = byMeal.get(key);
    if (cur) cur.qty += it.qty;
    else
      byMeal.set(key, {
        mealId: it.mealId!,
        mealName: it.nameSnapshot,
        station: stationFor(it.meal?.diet),
        qty: it.qty,
      });
  }

  await db.$transaction([
    db.productionTicket.deleteMany({ where: { businessId: business.id } }),
    db.productionTicket.createMany({
      data: [...byMeal.values()].map((t) => ({
        businessId: business.id,
        mealId: t.mealId,
        mealName: t.mealName,
        station: t.station,
        qty: t.qty,
        status: "todo" as const,
      })),
    }),
  ]);

  revalidatePath("/dashboard/kds");
}

/** Tap a ticket to advance it: todo → cooking → done → todo. */
export async function advanceTicket(formData: FormData) {
  const { business } = await requireBusiness();
  const id = String(formData.get("ticketId"));
  const ticket = await db.productionTicket.findFirst({
    where: { id, businessId: business.id },
    select: { status: true },
  });
  if (!ticket) return;

  const next = ticket.status === "todo" ? "cooking" : ticket.status === "cooking" ? "done" : "todo";
  await db.productionTicket.update({ where: { id }, data: { status: next } });
  revalidatePath("/dashboard/kds");
}

export async function clearTickets() {
  const { business } = await requireBusiness();
  await db.productionTicket.deleteMany({ where: { businessId: business.id } });
  revalidatePath("/dashboard/kds");
}

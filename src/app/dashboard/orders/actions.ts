"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";

const ORDER_STATUSES = [
  "pending",
  "paid",
  "in_production",
  "packed",
  "out_for_delivery",
  "fulfilled",
  "canceled",
  "refunded",
] as const;

const UpdateStatusInput = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
});

export async function updateOrderStatus(formData: FormData) {
  const { business } = await requireBusiness();
  const parsed = UpdateStatusInput.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  // Tenant guard: only touch orders belonging to this business.
  const order = await db.order.findFirst({
    where: { id: parsed.data.orderId, businessId: business.id },
    select: { id: true },
  });
  if (!order) return;

  await db.order.update({
    where: { id: parsed.data.orderId },
    data: { status: parsed.data.status },
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  revalidatePath("/dashboard");
}

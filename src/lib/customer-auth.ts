import { db } from "@/lib/db";
import type { Customer } from "@/generated/prisma/client";

/**
 * Customer-side auth seam — resolves which subscriber is viewing /account.
 *
 * Today: a dev stub that resolves a stable subscriber (the earliest-created
 * non-canceled subscription) so the account is clickable without customer
 * login — and stays on the same person when you pause/resume.
 *
 * Later (Clerk): map the signed-in customer's auth id → Customer row. The
 * /account page and its actions all scope to whatever this returns, so the
 * call sites won't change.
 */
export async function getCustomerContext(): Promise<{ customer: Customer } | null> {
  const sub = await db.subscription.findFirst({
    where: { status: { not: "canceled" } },
    orderBy: { createdAt: "asc" },
    include: { customer: true },
  });
  if (sub) return { customer: sub.customer };

  const customer = await db.customer.findFirst({ orderBy: { createdAt: "asc" } });
  return customer ? { customer } : null;
}

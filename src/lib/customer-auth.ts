import { db } from "@/lib/db";
import type { Customer } from "@/generated/prisma/client";

/**
 * Customer-side auth seam — resolves which subscriber is viewing /account.
 *
 * Clerk path (keys present): map the signed-in user's verified email to their
 * Customer row. Email is the link because guest checkout already creates
 * customers by email — so someone who ordered as a guest can later sign in with
 * the same email and manage their subscription. Returns null if they have no
 * orders yet (the page shows a "start ordering" state).
 *
 * Dev stub (no keys): a stable subscriber so the account is clickable without
 * customer login.
 */
const USE_DEV_AUTH =
  !process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY === "";

export async function getCustomerContext(): Promise<{ customer: Customer } | null> {
  if (USE_DEV_AUTH) {
    const sub = await db.subscription.findFirst({
      where: { status: { not: "canceled" } },
      orderBy: { createdAt: "asc" },
      include: { customer: true },
    });
    if (sub) return { customer: sub.customer };
    const customer = await db.customer.findFirst({ orderBy: { createdAt: "asc" } });
    return customer ? { customer } : null;
  }

  // Clerk path — map the signed-in identity to a Customer by verified email.
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return null; // middleware normally redirects; guard anyway
  const cu = await currentUser();
  const email = (
    cu?.primaryEmailAddress?.emailAddress ??
    cu?.emailAddresses?.[0]?.emailAddress ??
    ""
  )
    .trim()
    .toLowerCase();
  if (!email) return null;

  const customer = await db.customer.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  return customer ? { customer } : null;
}

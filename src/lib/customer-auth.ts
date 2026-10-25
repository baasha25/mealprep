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
import { DEV_STUB, assertAuthConfigured } from "@/lib/auth-mode";

// Opt-in dev stub only; a misconfigured production deploy fails closed.
const USE_DEV_AUTH = DEV_STUB;

/**
 * Kitchen-scoped customer resolver for /store/[slug]/account. Returns whether
 * the visitor is signed in and, if so, their Customer row *for this kitchen*
 * (matched by verified Clerk email + businessId). `signedIn: false` tells the
 * page to render the kitchen-branded sign-in instead of redirecting to the
 * generic owner login — so customers never fall into owner onboarding.
 */
/**
 * Sales sandbox: a visitor carrying the demo cookie for THIS demo kitchen is
 * treated as its demo customer (the latest subscriber, else latest customer),
 * so "Go to my account" works without a Clerk sign-in. Demo tenants only.
 */
async function demoCustomerFor(businessId?: string): Promise<Customer | null> {
  try {
    const { cookies } = await import("next/headers");
    const { DEMO_COOKIE, verifyDemoToken } = await import("@/lib/demo-session");
    const demoBusinessId = verifyDemoToken((await cookies()).get(DEMO_COOKIE)?.value);
    if (!demoBusinessId || (businessId && businessId !== demoBusinessId)) return null;
    const biz = await db.business.findFirst({ where: { id: demoBusinessId, isDemo: true }, select: { id: true } });
    if (!biz) return null;
    const sub = await db.subscription.findFirst({ where: { businessId: biz.id, status: { not: "canceled" } }, orderBy: { createdAt: "desc" }, include: { customer: true } });
    if (sub) return sub.customer;
    return db.customer.findFirst({ where: { businessId: biz.id }, orderBy: { createdAt: "desc" } });
  } catch {
    return null;
  }
}

export async function getKitchenCustomer(
  businessId: string,
): Promise<{ signedIn: boolean; customer: Customer | null }> {
  assertAuthConfigured();
  const demo = await demoCustomerFor(businessId);
  if (demo) return { signedIn: true, customer: demo };
  if (USE_DEV_AUTH) {
    const sub = await db.subscription.findFirst({
      where: { status: { not: "canceled" }, customer: { businessId } },
      orderBy: { createdAt: "asc" },
      include: { customer: true },
    });
    if (sub) return { signedIn: true, customer: sub.customer };
    const customer = await db.customer.findFirst({
      where: { businessId },
      orderBy: { createdAt: "asc" },
    });
    return { signedIn: true, customer };
  }

  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return { signedIn: false, customer: null };
  const cu = await currentUser();
  const email = (
    cu?.primaryEmailAddress?.emailAddress ??
    cu?.emailAddresses?.[0]?.emailAddress ??
    ""
  )
    .trim()
    .toLowerCase();
  if (!email) return { signedIn: true, customer: null };

  const customer = await db.customer.findFirst({
    where: { businessId, email },
    orderBy: { createdAt: "desc" },
  });
  return { signedIn: true, customer };
}

export async function getCustomerContext(): Promise<{ customer: Customer } | null> {
  const demo = await demoCustomerFor();
  if (demo) return { customer: demo };
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

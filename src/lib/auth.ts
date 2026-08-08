import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";
import { DEMO_COOKIE, verifyDemoToken } from "@/lib/demo-session";
import type { Business } from "@/generated/prisma/client";
import type { Role } from "@/lib/permissions";

/**
 * Resolve a demo session from the signed pf_demo cookie, or null. Loads ONLY a
 * business flagged `isDemo` — a demo cookie can never reach a real tenant, even
 * if its signature were somehow forged. Callers must give a REAL login priority
 * over this (a signed-in owner is never dropped into demo mode).
 */
async function resolveDemoContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(DEMO_COOKIE)?.value;
  const businessId = verifyDemoToken(token);
  if (!businessId) return null;
  const business = await db.business.findFirst({ where: { id: businessId, isDemo: true } });
  if (!business) return null;
  return { business, userId: null, role: "owner", userName: "Demo" };
}

/**
 * Auth seam — the ONLY place the app learns which business/tenant (and role) the
 * request belongs to. Every server action and dashboard query must scope by the
 * `businessId` this returns (CLAUDE.md §9: enforce tenant isolation everywhere).
 *
 * Today: a dev stub that resolves the first/seeded business so the app is
 * clickable without auth keys. Role comes from a `pf_role` cookie so the owner
 * can preview the staff-restricted view; defaults to owner.
 *
 * Later (Clerk): replace the body with
 *   const { userId } = await auth();            // from @clerk/nextjs/server
 *   const user = await db.user.findUnique({ where: { authProviderId: userId }, include: { business: true } });
 *   if (!user) redirect("/sign-in");
 *   return { business: user.business, userId, role: user.role };
 * The call sites below do not change.
 */

const USE_DEV_AUTH =
  !process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY === "";

export const ROLE_COOKIE = "pf_role";

export type AuthContext = {
  business: Business;
  /** Clerk user id once auth is wired; null under the dev stub. */
  userId: string | null;
  role: Role;
  /** Owner-set display name for this user (for greetings); null if unset/dev. */
  userName: string | null;
};

// Memoized per server request (React cache): the layout, the page, and any
// server actions in the same render share ONE user+business lookup instead of
// each firing their own. Big latency win on every dashboard navigation.
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  if (USE_DEV_AUTH) {
    // A demo cookie takes precedence in dev too, so demo mode is testable.
    const demo = await resolveDemoContext();
    if (demo) return demo;
    const business = await db.business.findFirst({
      // Never let a stray demo tenant become the default dev business.
      where: { isDemo: false },
      orderBy: { createdAt: "asc" },
    });
    if (!business) return null;
    const store = await cookies();
    const role: Role = store.get(ROLE_COOKIE)?.value === "staff" ? "staff" : "owner";
    return { business, userId: null, role, userName: null };
  }

  // Clerk path (active once CLERK_SECRET_KEY is set). Dynamic import so the
  // dev-stub path never touches Clerk.
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  // A REAL login always wins. Only when there's no signed-in user do we consider
  // a demo session — so a real owner can never be dropped into demo mode.
  if (!userId) {
    const demo = await resolveDemoContext();
    if (demo) return demo;
    redirect("/sign-in");
  }

  let user = await db.user.findUnique({
    where: { authProviderId: userId },
    include: { business: true },
  });

  // Not linked yet → claim a pending staff invite for this email, if one exists.
  // (Staff are added with a placeholder `invite:` id; first sign-in links it.)
  if (!user) {
    const cu = await currentUser();
    const email = (
      cu?.primaryEmailAddress?.emailAddress ??
      cu?.emailAddresses?.[0]?.emailAddress ??
      ""
    ).toLowerCase();
    if (email) {
      const invite = await db.user.findFirst({
        where: { email, authProviderId: { startsWith: "invite:" } },
      });
      if (invite) {
        user = await db.user.update({
          where: { id: invite.id },
          data: { authProviderId: userId },
          include: { business: true },
        });
      }
    }
    // A platform operator (super-admin) with no kitchen goes to the admin panel,
    // not the "create your kitchen" onboarding flow.
    if (!user && isSuperAdmin(email)) redirect("/admin");
  }

  // Signed in but no kitchen yet → onboarding provisions the Business + owner User.
  if (!user) redirect("/onboarding");

  return { business: user.business, userId, role: user.role as Role, userName: user.name };
});

/**
 * Use in dashboard pages and server actions. Returns the tenant context or
 * throws — never returns an unauthenticated request.
 */
export async function requireBusiness(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error(
      "No business found. Seed the database (`npm run db:seed`) or sign in.",
    );
  }
  return ctx;
}

/** Guard owner-only pages/actions: staff are redirected to the dashboard home. */
export async function requireOwner(): Promise<AuthContext> {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner") redirect("/dashboard");
  return ctx;
}

/**
 * Soft read-only lock: once a kitchen's trial has ended with no active plan, its
 * owner can still VIEW the dashboard but can't change configuration. Call this in
 * config-mutation server actions (menu, plans, settings, marketing). Operational
 * flows (orders, KDS, POS, inventory) and the customer storefront stay open so
 * the kitchen keeps running. Comped/trialing/subscribed kitchens pass through.
 */
export async function assertWritable(business: Business): Promise<void> {
  const { kitchenAccess, KITCHEN_BILLING_ENABLED } = await import("@/lib/kitchen-billing");
  // Never lock while billing isn't switched on — there'd be no way to pay.
  if (!KITCHEN_BILLING_ENABLED) return;
  const access = kitchenAccess({
    trialEndsAt: business.trialEndsAt,
    billingStatus: business.billingStatus as import("@/lib/kitchen-billing").BillingStatus,
    billingComped: business.billingComped,
    billingSubscriptionId: business.billingSubscriptionId,
  });
  if (access.locked) redirect("/dashboard/billing?locked=1");
}

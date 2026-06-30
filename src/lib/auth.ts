import { db } from "@/lib/db";
import type { Business } from "@/generated/prisma/client";

/**
 * Auth seam — the ONLY place the app learns which business/tenant the request
 * belongs to. Every server action and dashboard query must scope by the
 * `businessId` this returns (CLAUDE.md §9: enforce tenant isolation everywhere).
 *
 * Today: a dev stub that resolves the first/seeded business so the app is
 * clickable without auth keys.
 *
 * Later (Clerk): replace the body with
 *   const { userId } = await auth();            // from @clerk/nextjs/server
 *   const user = await db.user.findUnique({ where: { authProviderId: userId }, include: { business: true } });
 *   if (!user) redirect("/sign-in");
 *   return { business: user.business, user };
 * The call sites below do not change.
 */

const USE_DEV_AUTH =
  !process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY === "";

export type AuthContext = {
  business: Business;
  /** Clerk user id once auth is wired; null under the dev stub. */
  userId: string | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  if (USE_DEV_AUTH) {
    const business = await db.business.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!business) return null;
    return { business, userId: null };
  }

  // Clerk path (wired when keys are present) — intentionally not implemented yet.
  throw new Error(
    "Clerk auth is not wired yet. Add CLERK_SECRET_KEY and implement the Clerk branch in src/lib/auth.ts.",
  );
}

/**
 * Use in dashboard pages and server actions. Returns the tenant context or
 * throws — never returns an unauthenticated request. Convert the throw to a
 * redirect once real auth is in place.
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

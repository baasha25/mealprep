import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Business } from "@/generated/prisma/client";
import type { Role } from "@/lib/permissions";

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
};

// Memoized per server request (React cache): the layout, the page, and any
// server actions in the same render share ONE user+business lookup instead of
// each firing their own. Big latency win on every dashboard navigation.
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  if (USE_DEV_AUTH) {
    const business = await db.business.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!business) return null;
    const store = await cookies();
    const role: Role = store.get(ROLE_COOKIE)?.value === "staff" ? "staff" : "owner";
    return { business, userId: null, role };
  }

  // Clerk path (active once CLERK_SECRET_KEY is set). Dynamic import so the
  // dev-stub path never touches Clerk.
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

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
  }

  // Signed in but no kitchen yet → onboarding provisions the Business + owner User.
  if (!user) redirect("/onboarding");

  return { business: user.business, userId, role: user.role as Role };
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

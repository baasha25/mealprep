import { notFound } from "next/navigation";

// Platform super-admins (the PrepFlow operator) — an email allowlist, separate
// from any kitchen. They can see across all tenants; nobody else can reach /admin.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Gate a page/action to platform super-admins. 404s for everyone else (so the
 * panel is invisible to normal users). Returns the admin's email.
 */
export async function requireSuperAdmin(): Promise<string> {
  // Dev stub (no Clerk configured): allow, for local development only.
  if (!process.env.CLERK_SECRET_KEY) return "dev";

  const { currentUser } = await import("@clerk/nextjs/server");
  const cu = await currentUser();
  const email = (
    cu?.primaryEmailAddress?.emailAddress ??
    cu?.emailAddresses?.[0]?.emailAddress ??
    ""
  ).toLowerCase();

  if (!isSuperAdmin(email)) notFound();
  return email;
}

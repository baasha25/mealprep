// Role-based access. Owners see everything; staff (line cooks, packers) get the
// kitchen + selling tools but not money, customer PII, or configuration.

export type Role = "owner" | "staff";

// Sensitive areas restricted to owners.
export const OWNER_ONLY: string[] = [
  "/dashboard/analytics",
  "/dashboard/profitability",
  "/dashboard/reports",
  "/dashboard/marketing",
  "/dashboard/customers",
  "/dashboard/settings",
  "/dashboard/import",
  "/dashboard/staff",
];

export function isOwnerOnly(path: string): boolean {
  return OWNER_ONLY.some((p) => path === p || path.startsWith(p + "/"));
}

/** Can a role open a given dashboard path? */
export function canAccess(role: Role, path: string): boolean {
  return role === "owner" || !isOwnerOnly(path);
}

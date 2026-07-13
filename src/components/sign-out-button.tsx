"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

// Owner/staff sign-out for the dashboard shell. Only rendered when Clerk auth
// is enabled (there is no session to end under the dev stub), so useClerk()
// always has a provider here.
export function SignOutButton() {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: "/" })}
      className="mt-2.5 flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors"
      style={{ color: "#ffffff9a", background: "#ffffff0d" }}
    >
      <LogOut size={13} /> Sign out
    </button>
  );
}

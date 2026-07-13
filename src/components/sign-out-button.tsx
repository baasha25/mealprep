"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

// Sign-out control shared by the owner dashboard sidebar (dark "sidebar" tone)
// and the customer account header (light "link" tone). Only rendered when
// Clerk auth is enabled, so useClerk() always has a provider here.
export function SignOutButton({ tone = "sidebar" }: { tone?: "sidebar" | "link" }) {
  const { signOut } = useClerk();

  if (tone === "link") {
    return (
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/" })}
        className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
        style={{ color: "var(--muted)" }}
      >
        <LogOut size={14} /> Sign out
      </button>
    );
  }

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

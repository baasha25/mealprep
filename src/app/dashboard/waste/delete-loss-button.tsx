"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { deleteLoss } from "./actions";

/** Remove a mistakenly-logged loss. */
export function DeleteLossButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Delete loss"
      disabled={pending}
      onClick={() => start(async () => void (await deleteLoss(id)))}
      className="p-1 rounded-md disabled:opacity-40 hover:opacity-70"
      style={{ color: "var(--muted)" }}
    >
      <X size={14} />
    </button>
  );
}

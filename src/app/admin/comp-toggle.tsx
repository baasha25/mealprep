"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { setBusinessComped } from "./actions";

/** Toggle complimentary (founding-customer / demo) access for a kitchen. */
export function CompToggle({ businessId, comped }: { businessId: string; comped: boolean }) {
  const [on, setOn] = useState(comped);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          const res = await setBusinessComped(businessId, next);
          if (!res.ok) setOn(!next);
        })
      }
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border disabled:opacity-60"
      style={
        on
          ? { background: "var(--pine)", color: "#f4f2ec", borderColor: "var(--pine)" }
          : { background: "var(--paper)", color: "var(--ink)", borderColor: "var(--line)" }
      }
    >
      <Gift size={14} /> {on ? "Comped — free access" : "Comp this kitchen"}
    </button>
  );
}

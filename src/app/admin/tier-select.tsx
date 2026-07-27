"use client";

import { useTransition } from "react";
import { TIER_KEYS, TIERS, type TierKey } from "@/lib/tiers";
import { setBusinessTier } from "./actions";

/** Inline plan-tier selector for a kitchen (super-admin only). */
export function TierSelect({ businessId, tier }: { businessId: string; tier: TierKey }) {
  const [pending, start] = useTransition();

  return (
    <select
      value={tier}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as TierKey;
        start(async () => {
          await setBusinessTier(businessId, next);
        });
      }}
      className="rounded-md border px-2 py-1 text-[12.5px] outline-none disabled:opacity-60"
      style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
    >
      {TIER_KEYS.map((k) => (
        <option key={k} value={k}>
          {TIERS[k].name} — ${Math.round(TIERS[k].priceCents / 100)}/mo
        </option>
      ))}
    </select>
  );
}

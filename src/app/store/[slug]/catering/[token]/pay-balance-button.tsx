"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { payCateringBalance } from "../../../catering-actions";

/** Pay what is still owed (after a deposit, or an invoice) by card. */
export function PayBalanceButton({ slug, token, amountCents, label }: { slug: string; token: string; amountCents: number; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending || amountCents <= 0}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await payCateringBalance({ slug, token });
            if (!r.ok) return setError(r.message);
            if (r.checkoutUrl) window.location.href = r.checkoutUrl;
            else router.refresh();
          });
        }}
        className="w-full sm:w-auto px-6 py-3 rounded-lg text-[14.5px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: "var(--pine)", color: "#f4f2ec" }}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {label}
      </button>
      {error && <p className="text-[12.5px] mt-2" style={{ color: "var(--clay)" }}>{error}</p>}
    </div>
  );
}

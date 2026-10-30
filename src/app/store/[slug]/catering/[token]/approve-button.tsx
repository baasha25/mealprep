"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { formatCents } from "@/lib/money";
import { approveCateringQuote } from "../../../catering-actions";

/**
 * Approve the quote. Depending on the kitchen's terms this charges the full
 * amount, a deposit, or (net terms) just confirms and issues an invoice.
 */
export function ApproveButton({ slug, token, amountCents, totalCents, mode, approved }: { slug: string; token: string; amountCents: number; totalCents: number; mode: "card_full" | "card_deposit" | "invoice"; approved: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label =
    mode === "invoice"
      ? `Approve ${formatCents(totalCents)} · invoice me`
      : mode === "card_deposit"
        ? `${approved ? "Pay" : "Approve & pay"} ${formatCents(amountCents)} deposit`
        : `${approved ? "Pay" : "Approve & pay"} ${formatCents(amountCents)}`;
  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={pending || totalCents <= 0}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await approveCateringQuote({ slug, token });
            if (!r.ok) return setError(r.message);
            if (r.checkoutUrl) window.location.href = r.checkoutUrl;
            else router.refresh();
          });
        }}
        className="w-full sm:w-auto px-6 py-3 rounded-lg text-[14.5px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: "var(--pine)", color: "#f4f2ec" }}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {label}
      </button>
      <p className="text-[11.5px] mt-2" style={{ color: "var(--muted)" }}>
        {mode === "invoice" ? "No card now. Your date is confirmed on approval and the invoice arrives by email." : "Secure card payment. Your date is confirmed as soon as payment goes through."}
      </p>
      {error && <p className="text-[12.5px] mt-2" style={{ color: "var(--clay)" }}>{error}</p>}
    </div>
  );
}

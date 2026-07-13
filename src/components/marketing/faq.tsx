"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const ITEMS: [string, string][] = [
  ["How much does PrepFlow cost?", "Plans are $79/mo (Starter, up to 150 orders), $199/mo (Growth, unlimited), and $349/mo (Pro, unlimited) — billed monthly or annually. On top of that is a small platform fee that shrinks as you grow: 1.5% on Starter, 1.25% on Growth, 1.0% on Pro. Card processing is passed through at Stripe's cost — we never mark it up."],
  ["How long does it take to switch from another platform?", "Most kitchens are live in an afternoon. Our migration importer brings your menu, customers, and active subscriptions across from a CSV — no manual re-entry."],
  ["What makes the margin/waste tools different?", "PrepFlow is trim-aware. It knows the prep waste on every ingredient, so it shows the real dollars you're over-buying each production run — money most kitchens never see."],
  ["Do I need my own payment processor?", "You connect your own Stripe account, so customer payments go straight into your bank. PrepFlow takes its small platform fee automatically, and we never hold your money."],
  ["Can customers subscribe and manage their own plans?", "Yes. Diners order from your branded storefront, subscribe weekly or biweekly, and skip, pause, or swap meals themselves before your cut-off."],
  ["Is there a long-term contract?", "No. Plans are month-to-month, and annual billing saves you about two months. Start free, and upgrade only when your order volume grows."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-3xl mx-auto divide-y" style={{ borderColor: "var(--line)" }}>
      {ITEMS.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={i} style={{ borderColor: "var(--line)" }} className="border-t first:border-t-0">
            <button onClick={() => setOpen(on ? null : i)} className="w-full flex items-center justify-between gap-4 py-4 text-left">
              <span className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>{q}</span>
              <span className="grid place-items-center w-7 h-7 rounded-full shrink-0" style={{ background: on ? "var(--pine)" : "var(--sand)" }}>
                {on ? <Minus size={14} color="#f4f2ec" /> : <Plus size={14} style={{ color: "var(--ink)" }} />}
              </span>
            </button>
            {on && <p className="pb-4 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{a}</p>}
          </div>
        );
      })}
    </div>
  );
}

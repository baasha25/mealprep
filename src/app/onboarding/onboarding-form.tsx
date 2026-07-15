"use client";

import { useActionState, useState } from "react";
import { Leaf, Check } from "lucide-react";
import { createKitchen, type OnboardResult } from "./actions";
import { TIERS, TIER_KEYS, feePctLabel, type TierKey } from "@/lib/tiers";

const fmtPrice = (cents: number) => `$${Math.round(cents / 100)}`;

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<OnboardResult | null, FormData>(
    createKitchen,
    null,
  );
  const [tier, setTier] = useState<TierKey>("starter");

  return (
    <div
      className="min-h-screen grid place-items-center px-6 py-12"
      style={{ background: "var(--paper)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-8"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="grid place-items-center w-9 h-9 rounded-md"
            style={{ background: "var(--pine)" }}
          >
            <Leaf size={18} color="#f4f2ec" />
          </div>
          <div className="disp text-[19px] font-medium" style={{ color: "var(--ink)" }}>
            Set up your kitchen
          </div>
        </div>

        <p className="text-[14px] mb-6" style={{ color: "var(--ink-soft)" }}>
          Give your meal-prep business a name and a brand color. You can change
          everything later in Settings.
        </p>

        <form action={formAction} className="space-y-5">
          <div>
            <label
              className="block text-[13px] font-medium mb-1.5"
              style={{ color: "var(--ink)" }}
            >
              Kitchen name
            </label>
            <input
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Greenleaf Kitchen"
              className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
              style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </div>

          <div>
            <label
              className="block text-[13px] font-medium mb-1.5"
              style={{ color: "var(--ink)" }}
            >
              Brand color
            </label>
            <input
              name="brandColor"
              type="color"
              defaultValue="#2f4536"
              className="h-10 w-16 rounded-lg border p-1"
              style={{ borderColor: "var(--line)", background: "var(--paper)" }}
            />
          </div>

          {/* Plan picker — drives the platform fee. No card required to start. */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Choose your plan
            </label>
            <input type="hidden" name="tier" value={tier} />
            <div className="space-y-2">
              {TIER_KEYS.map((k) => {
                const t = TIERS[k];
                const on = tier === k;
                return (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setTier(k)}
                    className="w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors"
                    style={{
                      borderColor: on ? "var(--pine)" : "var(--line)",
                      background: on ? "color-mix(in srgb, var(--pine) 7%, transparent)" : "var(--paper)",
                      boxShadow: on ? "0 0 0 1px var(--pine)" : "none",
                    }}
                  >
                    <span
                      className="grid place-items-center w-5 h-5 rounded-full shrink-0"
                      style={{ background: on ? "var(--pine)" : "transparent", border: on ? "none" : "1.5px solid var(--line)" }}
                    >
                      {on && <Check size={12} color="#f4f2ec" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{t.name}</span>
                        <span className="text-[12px]" style={{ color: "var(--muted)" }}>{t.blurb}</span>
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--ink-soft)" }}>
                        {t.orderLimit ? `Up to ${t.orderLimit} orders/mo` : "Unlimited orders"} · {feePctLabel(k)} platform fee
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>{fmtPrice(t.priceCents)}</span>
                      <span className="text-[11px]" style={{ color: "var(--muted)" }}>/mo</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] mt-2" style={{ color: "var(--muted)" }}>
              Start free — no card required. You can change your plan later in Settings.
            </p>
          </div>

          {state && !state.ok && (
            <div className="text-[13px]" style={{ color: "var(--clay)" }}>
              {state.message}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg px-4 py-2.5 text-[14px] font-medium disabled:opacity-60"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            {pending ? "Creating…" : "Create my kitchen"}
          </button>
        </form>
      </div>
    </div>
  );
}

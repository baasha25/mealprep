"use client";

import { useState, useTransition } from "react";
import { formatCents } from "@/lib/money";
import { startPlanSubscription } from "./subscribe-actions";

export type PlanCard = {
  id: string;
  name: string;
  mealsPerWeek: number;
  perMealPriceCents: number;
};

export function PlanCards({
  slug,
  plans,
  subDiscountPct,
}: {
  slug: string;
  plans: PlanCard[];
  subDiscountPct: number;
}) {
  const [freq, setFreq] = useState<"weekly" | "biweekly">("weekly");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const subscribe = (planId: string) => {
    setError("");
    setBusyId(planId);
    startTransition(async () => {
      const r = await startPlanSubscription({ slug, planId, frequency: freq });
      if (r.ok) {
        window.location.href = r.url;
        return;
      }
      setError(r.message);
      setBusyId(null);
    });
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Subscription plans
        </h2>
        <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)" }}>
          {(["weekly", "biweekly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFreq(f)}
              className="px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors"
              style={{
                background: freq === f ? "var(--pine)" : "transparent",
                color: freq === f ? "#f4f2ec" : "var(--muted)",
              }}
            >
              {f === "weekly" ? "Weekly" : "Every 2 weeks"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {plans.map((p) => {
          const weekly = p.mealsPerWeek * p.perMealPriceCents;
          const perCharge = freq === "biweekly" ? weekly * 2 : weekly;
          return (
            <div
              key={p.id}
              className="rounded-xl border p-4 flex flex-col"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{p.name}</div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                {p.mealsPerWeek} meals/week · {formatCents(p.perMealPriceCents)}/meal
              </div>
              <div className="mt-2">
                <span className="disp text-[20px] font-medium" style={{ color: "var(--pine)" }}>
                  {formatCents(weekly)}
                </span>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}> /week</span>
              </div>
              <button
                onClick={() => subscribe(p.id)}
                disabled={pending}
                className="mt-3 w-full py-2 rounded-lg text-[13px] font-medium disabled:opacity-60"
                style={{ background: "var(--pine)", color: "#f4f2ec" }}
              >
                {busyId === p.id ? "Starting…" : "Subscribe"}
              </button>
              <div className="text-[11px] mt-1.5 text-center" style={{ color: "var(--muted)" }}>
                Billed {freq === "weekly" ? "weekly" : "every 2 weeks"} · {formatCents(perCharge)}/charge
              </div>
            </div>
          );
        })}
      </div>

      {subDiscountPct > 0 && (
        <p className="text-[12px] mt-2.5" style={{ color: "var(--muted)" }}>
          Subscribers save vs one-time orders, and you can pause, skip, or cancel anytime.
        </p>
      )}
      {error && (
        <p className="text-[12px] mt-2" style={{ color: "var(--clay)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

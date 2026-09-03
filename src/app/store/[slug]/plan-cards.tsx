"use client";

import { useState, useTransition } from "react";
import { formatCents } from "@/lib/money";
import { dayFullName } from "@/lib/delivery-days";
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
  deliveryDays = [],
}: {
  slug: string;
  plans: PlanCard[];
  subDiscountPct: number;
  /** The kitchen's enabled delivery weekdays, in week order (e.g. ["Mon","Thu"]). */
  deliveryDays?: string[];
}) {
  const [freq, setFreq] = useState<"weekly" | "biweekly">("weekly");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Let the customer pick which delivery day(s) they want — only meaningful when
  // the kitchen runs more than one. Default to the soonest single day.
  const canChooseDays = deliveryDays.length >= 2;
  const [chosenDays, setChosenDays] = useState<string[]>(
    deliveryDays.length ? [deliveryDays[0]] : [],
  );
  const toggleDay = (d: string) =>
    setChosenDays((cur) => {
      if (cur.includes(d)) {
        // Keep at least one day selected.
        return cur.length === 1 ? cur : cur.filter((x) => x !== d);
      }
      // Preserve week order so the soonest day stays first.
      return deliveryDays.filter((x) => cur.includes(x) || x === d);
    });

  const subscribe = (planId: string) => {
    setError("");
    setBusyId(planId);
    startTransition(async () => {
      const r = await startPlanSubscription({
        slug,
        planId,
        frequency: freq,
        deliveryDays: canChooseDays ? chosenDays : undefined,
      });
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

      {canChooseDays && (
        <div
          className="rounded-xl border p-3.5 mb-3"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                Delivery day
              </div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                Pick a day — or choose both to split your week into two fresh drops (same price).
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {deliveryDays.map((d) => {
                const on = chosenDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={on}
                    className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors"
                    style={{
                      background: on ? "var(--pine)" : "transparent",
                      color: on ? "#f4f2ec" : "var(--ink-soft)",
                      borderColor: on ? "var(--pine)" : "var(--line)",
                    }}
                  >
                    {dayFullName(d)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                className="mt-3 w-full py-2 rounded-lg text-[13px] font-medium transition-opacity"
                style={{
                  background: "var(--pine)",
                  color: "#f4f2ec",
                  // Only the plan you clicked shows the busy state; the others stay
                  // put (still disabled, to prevent starting a second checkout).
                  opacity: busyId === p.id ? 0.6 : 1,
                  cursor: pending ? "default" : "pointer",
                }}
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

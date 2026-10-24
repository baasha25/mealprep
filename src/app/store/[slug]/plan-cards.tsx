"use client";

import { useState, useTransition } from "react";
import { formatCents } from "@/lib/money";
import { dayFullName } from "@/lib/delivery-days";
import { zoneForPostal, postalLooksComplete } from "@/lib/zones";
import { subscriptionWeeklyCharge } from "@/lib/subscription-orders";
import { startPlanSubscription } from "./subscribe-actions";

export type PlanCard = {
  id: string;
  name: string;
  mealsPerWeek: number;
  perMealPriceCents: number;
};

/** A delivery zone as the plan picker needs it: its prefixes, its days, its weekly fee. */
export type PlanZone = {
  id: string;
  name: string;
  postalPrefixes: string[];
  deliveryDays: Record<string, boolean>;
  deliveryFeeCents: number | null;
  days: string[]; // the zone's delivery weekdays, in week order
  feeCents: number; // resolved: zone fee, or the kitchen's default
};

export function PlanCards({
  slug,
  plans,
  subDiscountPct,
  deliveryDays = [],
  zones = [],
}: {
  slug: string;
  plans: PlanCard[];
  subDiscountPct: number;
  /** The kitchen's enabled delivery weekdays, in week order (e.g. ["Mon","Thu"]). */
  deliveryDays?: string[];
  /** Delivery zones (empty = off). With zones, the postal code picks the days and the weekly fee. */
  zones?: PlanZone[];
}) {
  const [freq, setFreq] = useState<"weekly" | "biweekly">("weekly");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Zone-based delivery: the postal code places the subscriber in a zone; the
  // zone decides which days are on offer and the delivery fee charged each week.
  const zonesOn = zones.length > 0;
  const [postal, setPostal] = useState("");
  const zone = zonesOn ? zoneForPostal(postal, zones) : null;
  const outsideZones = zonesOn && postalLooksComplete(postal) && !zone;
  const needPostal = zonesOn && !zone;
  const offeredDays = zone ? zone.days : deliveryDays;
  const feeCents = zone ? zone.feeCents : 0;

  // Let the customer pick which delivery day(s) they want — only meaningful when
  // more than one is on offer. Default to the soonest single day.
  const canChooseDays = offeredDays.length >= 2;
  const [chosenDays, setChosenDays] = useState<string[]>(deliveryDays.length ? [deliveryDays[0]] : []);
  // Only days the active zone offers count; otherwise the zone's soonest day.
  const effectiveDays = chosenDays.filter((d) => offeredDays.includes(d));
  const pickedDays = effectiveDays.length ? effectiveDays : offeredDays.slice(0, 1);
  const toggleDay = (d: string) =>
    setChosenDays(() => {
      const cur = pickedDays;
      if (cur.includes(d)) {
        // Keep at least one day selected.
        return cur.length === 1 ? cur : cur.filter((x) => x !== d);
      }
      // Preserve week order so the soonest day stays first.
      return offeredDays.filter((x) => cur.includes(x) || x === d);
    });

  const subscribe = (planId: string) => {
    setError("");
    if (needPostal) {
      setError(outsideZones ? `We don't deliver to ${postal.trim().toUpperCase()} yet.` : "Enter your postal code so we can find your delivery day.");
      return;
    }
    setBusyId(planId);
    startTransition(async () => {
      const r = await startPlanSubscription({
        slug,
        planId,
        frequency: freq,
        deliveryDays: canChooseDays ? pickedDays : undefined,
        postalCode: zonesOn ? postal : undefined,
      });
      if (r.ok) {
        window.location.href = r.url;
        return;
      }
      setError(r.message);
      setBusyId(null);
    });
  };

  const intervalCount = freq === "biweekly" ? 2 : 1;

  return (
    <div id="plans" className="mb-8 scroll-mt-6">
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

      {zonesOn && (
        <div className="rounded-xl border p-3.5 mb-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>Where should we deliver?</div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                {zone
                  ? `${zone.name}: delivered ${zone.days.length === 1 ? `${dayFullName(zone.days[0])}s` : zone.days.map(dayFullName).join(" & ")} · ${zone.feeCents === 0 ? "free delivery" : `${formatCents(zone.feeCents)} delivery each week`}`
                  : outsideZones
                    ? `We don't deliver to ${postal.trim().toUpperCase()} yet.`
                    : "Your postal code sets your delivery day and fee."}
              </div>
            </div>
            <input
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              placeholder="Postal code"
              autoComplete="postal-code"
              aria-label="Postal code"
              className="px-3 py-2 rounded-md border text-[13px] outline-none w-36 uppercase"
              style={{ borderColor: outsideZones ? "var(--clay)" : "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </div>
        </div>
      )}

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
              {offeredDays.map((d) => {
                const on = pickedDays.includes(d);
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
          const charge = subscriptionWeeklyCharge({ mealsPerWeek: p.mealsPerWeek, perMealPriceCents: p.perMealPriceCents, deliveryFeeCents: feeCents, intervalCount });
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
                  {formatCents(charge.weeklyPlanCents)}
                </span>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}> /week</span>
                {feeCents > 0 && (
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}> + {formatCents(feeCents)} delivery</span>
                )}
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
                  opacity: busyId === p.id ? 0.6 : needPostal ? 0.7 : 1,
                  cursor: pending ? "default" : "pointer",
                }}
              >
                {busyId === p.id ? "Starting…" : "Subscribe"}
              </button>
              <div className="text-[11px] mt-1.5 text-center" style={{ color: "var(--muted)" }}>
                Billed {freq === "weekly" ? "weekly" : "every 2 weeks"} · {formatCents(charge.totalCents)}/charge
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

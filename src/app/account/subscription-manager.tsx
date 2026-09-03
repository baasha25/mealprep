"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Repeat,
  Pause,
  Play,
  CalendarDays,
  SkipForward,
  Plus,
  Minus,
  Check,
  Lock,
  Clock,
  Truck,
} from "lucide-react";
import { formatCents } from "@/lib/money";
import { dayFullName } from "@/lib/delivery-days";
import {
  pauseSubscription,
  resumeSubscription,
  skipNextDelivery,
  cancelSubscription,
  updateSelection,
  updateDeliveryDays,
} from "./actions";

export type ManagerMeal = { id: string; name: string; priceCents: number; diet: string | null };

/** One editable delivery in the current cycle, with the meals chosen for it. */
export type DeliverySlot = {
  dateISO: string;
  label: string; // "Mon, Aug 31"
  fullLabel: string; // "Monday, Aug 31"
  selection: Record<string, number>;
};

export function SubscriptionManager({
  subscriptionId,
  status,
  planName,
  frequencyLabel,
  nextDeliveryLabel,
  cutoffLabel,
  cutoffISO,
  upcomingDates,
  canModify,
  perMealPriceCents,
  deliveries,
  chosenDays,
  allDeliveryDays,
  meals,
}: {
  subscriptionId: string;
  status: "active" | "paused" | "canceled";
  planName: string;
  frequencyLabel: string;
  nextDeliveryLabel: string;
  cutoffLabel: string;
  cutoffISO: string | null;
  upcomingDates: string[];
  canModify: boolean;
  perMealPriceCents: number;
  deliveries: DeliverySlot[];
  chosenDays: string[];
  allDeliveryDays: string[];
  meals: ManagerMeal[];
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  // Per-delivery meal picks (multi-day subscribers split their plan across days).
  const multiDay = deliveries.length > 1;
  const [active, setActive] = useState(0);
  const [sels, setSels] = useState<Record<string, number>[]>(
    deliveries.map((d) => ({ ...d.selection })),
  );
  const [dirty, setDirty] = useState<boolean[]>(deliveries.map(() => false));
  const sel = sels[active] ?? {};

  // Live cut-off countdown (client-only; "—" until mounted to avoid hydration drift).
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!cutoffISO) return;
    const target = new Date(cutoffISO).getTime();
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) {
        setCountdown("passed");
        return;
      }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setCountdown(
        `${d > 0 ? `${d}d ` : ""}${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cutoffISO]);

  const flash = (r: { ok: boolean; message: string }) => {
    setToast(r);
    setTimeout(() => setToast(null), 3000);
  };

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => flash(await fn()));

  const setQty = (id: string, delta: number) => {
    setSels((cur) =>
      cur.map((slot, i) => {
        if (i !== active) return slot;
        const n = Math.max(0, (slot[id] || 0) + delta);
        const x = { ...slot };
        if (n === 0) delete x[id];
        else x[id] = n;
        return x;
      }),
    );
    setDirty((cur) => cur.map((d, i) => (i === active ? true : d)));
  };

  const totalMeals = Object.values(sel).reduce((a, b) => a + b, 0);
  const cycleCents = totalMeals * perMealPriceCents;
  const weekMeals = sels.reduce((a, slot) => a + Object.values(slot).reduce((x, y) => x + y, 0), 0);

  const saveSelection = () =>
    startTransition(async () => {
      const slot = deliveries[active];
      const r = await updateSelection({
        subscriptionId,
        deliveryDate: slot?.dateISO,
        items: Object.entries(sel).map(([mealId, qty]) => ({ mealId, qty })),
      });
      flash(r);
      if (r.ok) setDirty((cur) => cur.map((d, i) => (i === active ? false : d)));
    });

  // Delivery-days editor (only when the kitchen runs 2+ days).
  const canChooseDays = allDeliveryDays.length >= 2;
  const [dayPick, setDayPick] = useState<string[]>(chosenDays.length ? chosenDays : allDeliveryDays.slice(0, 1));
  const daysDirty = dayPick.join(",") !== chosenDays.join(",");
  const toggleDay = (d: string) =>
    setDayPick((cur) => {
      if (cur.includes(d)) return cur.length === 1 ? cur : cur.filter((x) => x !== d);
      return allDeliveryDays.filter((x) => cur.includes(x) || x === d);
    });
  const saveDays = () =>
    startTransition(async () => flash(await updateDeliveryDays({ subscriptionId, days: dayPick })));

  const paused = status === "paused";

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className="fade fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-3 rounded-xl text-[13.5px] font-medium flex items-center gap-2"
          style={{
            background: "var(--surface)",
            color: toast.ok ? "var(--pine)" : "var(--clay)",
            border: `1px solid ${toast.ok ? "color-mix(in srgb, var(--pine) 35%, transparent)" : "var(--clay)"}`,
            boxShadow: "0 14px 34px -10px rgba(31,30,26,0.28)",
          }}
          role="status"
        >
          {toast.ok ? <Check size={16} /> : null}
          {toast.message}
        </div>
      )}

      {/* Status + delivery */}
      <div className="rounded-xl border p-5" style={cardStyle}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="grid place-items-center w-10 h-10 rounded-lg"
              style={{ background: paused ? "var(--sand)" : "color-mix(in srgb, var(--pine) 12%, transparent)" }}
            >
              <Repeat size={18} style={{ color: paused ? "var(--muted)" : "var(--pine)" }} />
            </div>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                {planName} plan
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
                {frequencyLabel} ·{" "}
                <span style={{ color: paused ? "var(--clay)" : "var(--pine)" }}>
                  {paused ? "Paused" : "Active"}
                </span>
              </div>
            </div>
          </div>
          {paused ? (
            <button
              onClick={() => run(() => resumeSubscription(subscriptionId))}
              disabled={pending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              <Play size={15} /> Resume
            </button>
          ) : (
            <button
              onClick={() => run(() => pauseSubscription(subscriptionId))}
              disabled={pending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border disabled:opacity-60"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <Pause size={15} /> Pause
            </button>
          )}
        </div>

        <div
          className="mt-4 pt-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} style={{ color: "var(--muted)" }} />
            <div>
              <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                {paused ? "Deliveries paused" : `Next delivery ${nextDeliveryLabel}`}
              </div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                Changes lock at the cut-off ({cutoffLabel})
              </div>
            </div>
          </div>
          <button
            onClick={() => run(() => skipNextDelivery(subscriptionId))}
            disabled={pending || !canModify}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border disabled:opacity-50"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            title={canModify ? "Skip the next delivery" : "Locked — past the cut-off or paused"}
          >
            {canModify ? <SkipForward size={14} /> : <Lock size={13} />} Skip next
          </button>
        </div>

        {!paused && countdown && countdown !== "passed" && (
          <div
            className="mt-4 pt-4 flex items-center gap-2.5"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <Clock size={16} style={{ color: "var(--clay)" }} />
            <div>
              <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                Order deadline for your next delivery
              </div>
              <div
                className="text-[17px] font-semibold"
                style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}
              >
                {countdown}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delivery days editor */}
      {canChooseDays && (
        <div className="rounded-xl border p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-1">
            <Truck size={16} style={{ color: "var(--muted)" }} />
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Delivery days
            </h3>
          </div>
          <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
            Choose the day you get your meals — or pick both to split your week into two fresh drops
            (same price).
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {allDeliveryDays.map((d) => {
              const on = dayPick.includes(d);
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
            {daysDirty && (
              <button
                onClick={saveDays}
                disabled={pending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium disabled:opacity-50"
                style={{ background: "var(--pine)", color: "#f4f2ec" }}
              >
                <Check size={14} /> {pending ? "Saving…" : "Save days"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Meal selection editor (per delivery day when split) */}
      {deliveries.length > 0 && (
        <div className="rounded-xl border p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              {multiDay ? "Meals for each delivery" : "Meals for your next delivery"}
            </h3>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {totalMeals} meals · {formatCents(cycleCents)}
            </span>
          </div>

          {multiDay && (
            <>
              <p className="text-[12px] mb-2.5" style={{ color: "var(--muted)" }}>
                Split your plan across your two delivery days — {weekMeals} meals this week in total.
              </p>
              <div className="inline-flex rounded-lg border p-0.5 mb-3" style={{ borderColor: "var(--line)" }}>
                {deliveries.map((d, i) => {
                  const count = Object.values(sels[i] ?? {}).reduce((a, b) => a + b, 0);
                  return (
                    <button
                      key={d.dateISO}
                      onClick={() => setActive(i)}
                      className="px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors"
                      style={{
                        background: active === i ? "var(--pine)" : "transparent",
                        color: active === i ? "#f4f2ec" : "var(--muted)",
                      }}
                    >
                      {d.label} <span style={{ opacity: 0.75 }}>· {count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {!canModify && (
            <p
              className="text-[12px] mb-3 mt-1 px-3 py-2 rounded-md flex items-center gap-1.5"
              style={{ background: "var(--sand)", color: "var(--muted)" }}
            >
              <Lock size={12} /> Editing is locked — you&apos;re past the cut-off or paused.
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-2.5 mt-1">
            {meals.map((m) => {
              const qty = sel[m.id] || 0;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{
                    background: qty > 0 ? "color-mix(in srgb, var(--pine) 5%, transparent)" : "var(--paper)",
                    border: `1px solid ${qty > 0 ? "color-mix(in srgb, var(--pine) 25%, transparent)" : "var(--line)"}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                      {m.name}
                    </div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                      {m.diet ? `${m.diet} · ` : ""}
                      {formatCents(m.priceCents)}
                    </div>
                  </div>
                  {qty === 0 ? (
                    <button
                      onClick={() => setQty(m.id, 1)}
                      disabled={!canModify}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium border disabled:opacity-40"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    >
                      <Plus size={13} /> Add
                    </button>
                  ) : (
                    <div
                      className="flex items-center gap-2.5 px-2 py-1 rounded-md"
                      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                    >
                      <button onClick={() => setQty(m.id, -1)} disabled={!canModify} aria-label="Remove one">
                        <Minus size={14} style={{ color: "var(--ink)" }} />
                      </button>
                      <span className="text-[13px] font-semibold w-4 text-center" style={{ color: "var(--ink)" }}>
                        {qty}
                      </span>
                      <button onClick={() => setQty(m.id, 1)} disabled={!canModify} aria-label="Add one">
                        <Plus size={14} style={{ color: "var(--ink)" }} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {canModify && (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={saveSelection}
                disabled={pending || !dirty[active] || totalMeals === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
                style={{ background: "var(--pine)", color: "#f4f2ec" }}
              >
                <Check size={15} />{" "}
                {pending ? "Saving…" : multiDay ? `Save ${deliveries[active]?.label} meals` : "Save meals"}
              </button>
              {dirty[active] && (
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Unsaved changes
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upcoming deliveries */}
      {!paused && upcomingDates.length > 0 && (
        <div className="rounded-xl border p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} style={{ color: "var(--muted)" }} />
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Upcoming deliveries
            </h3>
          </div>
          <div className="space-y-2">
            {upcomingDates.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[13px] px-3 py-2 rounded-lg"
                style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
              >
                <span style={{ color: "var(--ink)" }}>{d}</span>
                {i === 0 && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "color-mix(in srgb, var(--pine) 12%, transparent)", color: "var(--pine)" }}
                  >
                    Next
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel */}
      {status !== "canceled" && (
        <div className="flex items-center justify-between gap-3 flex-wrap px-1 pt-1">
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            Need to stop your plan?
          </span>
          <button
            onClick={() => {
              if (window.confirm("Cancel your subscription? You can start a new one anytime."))
                run(() => cancelSubscription(subscriptionId));
            }}
            disabled={pending}
            className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium border disabled:opacity-50"
            style={{ color: "var(--clay)", borderColor: "var(--clay)", background: "transparent" }}
          >
            Cancel subscription
          </button>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(31,30,26,.03)",
} as const;

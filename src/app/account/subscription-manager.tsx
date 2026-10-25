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
import { resolveSelections, optionsKeyOf } from "@/lib/meal-options";
import {
  pauseSubscription,
  resumeSubscription,
  skipNextDelivery,
  cancelSubscription,
  updateSelection,
  updateDeliveryDays,
} from "./actions";

export type ManagerOption = { id: string; name: string; priceDeltaCents: number; isDefault: boolean };
export type ManagerOptionGroup = { id: string; name: string; minSelect: number; maxSelect: number; options: ManagerOption[] };
export type ManagerMeal = { id: string; name: string; priceCents: number; diet: string | null; optionGroups?: ManagerOptionGroup[] };
/** One picked line: a meal, how many, and (build-your-own) which options. */
export type SlotItem = { mealId: string; qty: number; optionIds: string[] };

/** One editable delivery in the current cycle, with the meals chosen for it. */
export type DeliverySlot = {
  dateISO: string;
  label: string; // "Mon, Aug 31"
  fullLabel: string; // "Monday, Aug 31"
  selection: SlotItem[];
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
  planMeals = 0,
  deliveries,
  chosenDays,
  allDeliveryDays,
  zoneLine = null,
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
  /** Meals per week the plan covers; anything picked beyond it is an extra at the plan's per-meal price. */
  planMeals?: number;
  deliveries: DeliverySlot[];
  chosenDays: string[];
  allDeliveryDays: string[];
  /** Zone kitchens: "North Shore · Sundays · $7.00 delivery each week". */
  zoneLine?: string | null;
  meals: ManagerMeal[];
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  // Per-delivery meal picks (multi-day subscribers split their plan across days).
  const multiDay = deliveries.length > 1;
  const [active, setActive] = useState(0);
  // Lines keyed by meal + options ("mealId|optA+optB"), so the same meal can be
  // picked twice with different options.
  type Line = { mealId: string; qty: number; optionIds: string[] };
  const keyOf = (mealId: string, optionIds: string[]) => `${mealId}|${optionsKeyOf(optionIds)}`;
  const [sels, setSels] = useState<Record<string, Line>[]>(
    deliveries.map((d) => Object.fromEntries(d.selection.map((l) => [keyOf(l.mealId, l.optionIds), { ...l }]))),
  );
  const [dirty, setDirty] = useState<boolean[]>(deliveries.map(() => false));
  const sel = sels[active] ?? {};
  const mealById = new Map(meals.map((m) => [m.id, m]));
  // Option price delta for a line (0 when the meal has no options or they can't resolve).
  const deltaOf = (l: Line) => {
    const m = mealById.get(l.mealId);
    if (!m?.optionGroups?.length) return 0;
    const r = resolveSelections(m.optionGroups, l.optionIds);
    return r.ok ? r.priceDeltaCents : 0;
  };
  const labelOf = (l: Line) => {
    const m = mealById.get(l.mealId);
    if (!m?.optionGroups?.length) return m?.name ?? "Meal";
    const r = resolveSelections(m.optionGroups, l.optionIds);
    return r.ok && r.picks.length ? `${m.name} (${r.picks.map((p) => p.optionName).join(" · ")})` : m.name;
  };
  // Build-your-own chooser (modal) for meals with option groups.
  const [chooser, setChooser] = useState<{ mealId: string; picks: Record<string, string[]>; error: string | null } | null>(null);
  const openChooser = (m: ManagerMeal) => {
    const picks: Record<string, string[]> = {};
    for (const g of m.optionGroups ?? []) picks[g.id] = g.options.filter((o) => o.isDefault).slice(0, g.maxSelect).map((o) => o.id);
    setChooser({ mealId: m.id, picks, error: null });
  };

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

  const setQty = (mealId: string, delta: number, optionIds: string[] = []) => {
    const key = keyOf(mealId, optionIds);
    setSels((cur) =>
      cur.map((slot, i) => {
        if (i !== active) return slot;
        const n = Math.max(0, (slot[key]?.qty || 0) + delta);
        const x = { ...slot };
        if (n === 0) delete x[key];
        else x[key] = { mealId, qty: n, optionIds };
        return x;
      }),
    );
    setDirty((cur) => cur.map((d, i) => (i === active ? true : d)));
  };
  const confirmChooser = () => {
    if (!chooser) return;
    const m = mealById.get(chooser.mealId);
    if (!m) return;
    const r = resolveSelections(m.optionGroups ?? [], Object.values(chooser.picks).flat());
    if (!r.ok) return setChooser({ ...chooser, error: r.message });
    setQty(m.id, 1, r.picks.map((p) => p.optionId));
    setChooser(null);
  };
  const qtyOfMeal = (mealId: string) => Object.values(sel).filter((l) => l.mealId === mealId).reduce((a, l) => a + l.qty, 0);

  const totalMeals = Object.values(sel).reduce((a, l) => a + l.qty, 0);
  const weekMeals = sels.reduce((a, slot) => a + Object.values(slot).reduce((x, l) => x + l.qty, 0), 0);
  const upgradesCents = sels.reduce((a, slot) => a + Object.values(slot).reduce((x, l) => x + l.qty * deltaOf(l), 0), 0);
  // Extras: picks beyond the plan this week, at the plan's per-meal price,
  // billed with the next plan payment and delivered in the same box.
  const extras = planMeals > 0 ? Math.max(0, weekMeals - planMeals) : 0;
  const extrasCents = extras * perMealPriceCents;
  const shortBy = planMeals > 0 ? Math.max(0, planMeals - weekMeals) : 0;

  const saveSelection = () =>
    startTransition(async () => {
      const slot = deliveries[active];
      const r = await updateSelection({
        subscriptionId,
        deliveryDate: slot?.dateISO,
        items: Object.values(sel).map((l) => ({ mealId: l.mealId, qty: l.qty, optionIds: l.optionIds.length ? l.optionIds : undefined })),
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
              {zoneLine && (
                <div className="text-[11.5px] mt-0.5 flex items-center gap-1" style={{ color: "var(--ink-soft)" }}>
                  <Truck size={12} /> {zoneLine}
                </div>
              )}
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
              {planMeals > 0 ? `${weekMeals} of ${planMeals} plan meals` : `${totalMeals} meals · ${formatCents(totalMeals * perMealPriceCents)}`}
              {extras > 0 && <span style={{ color: "var(--pine)" }}> · +{extras} extra{extras === 1 ? "" : "s"} · {formatCents(extrasCents)}</span>}
              {upgradesCents > 0 && <span style={{ color: "var(--pine)" }}> · upgrades {formatCents(upgradesCents)}</span>}
            </span>
          </div>
          {upgradesCents > 0 && (
            <p className="text-[12px] mb-2" style={{ color: "var(--pine)" }}>
              Option upgrades ({formatCents(upgradesCents)}) are billed with your next plan payment.
            </p>
          )}
          {planMeals > 0 && (
            <p className="text-[12px] mb-2.5" style={{ color: extras > 0 ? "var(--pine)" : "var(--muted)" }}>
              {extras > 0
                ? `${extras} extra meal${extras === 1 ? "" : "s"} at ${formatCents(perMealPriceCents)} each (${formatCents(extrasCents)}) will be billed with your next plan payment and delivered with this box. No extra delivery fee.`
                : shortBy > 0
                  ? `Pick ${shortBy} more to fill your plan. Want more? Anything beyond ${planMeals} is ${formatCents(perMealPriceCents)} a meal, billed with your next payment, same delivery.`
                  : `Your plan is full. Add more if you like: ${formatCents(perMealPriceCents)} a meal, billed with your next payment, same delivery.`}
            </p>
          )}

          {multiDay && (
            <>
              <p className="text-[12px] mb-2.5" style={{ color: "var(--muted)" }}>
                Split your plan across your two delivery days — {weekMeals} meals this week in total.
              </p>
              <div className="inline-flex rounded-lg border p-0.5 mb-3" style={{ borderColor: "var(--line)" }}>
                {deliveries.map((d, i) => {
                  const count = Object.values(sels[i] ?? {}).reduce((a, b) => a + b.qty, 0);
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
              const hasOptions = (m.optionGroups?.length ?? 0) > 0;
              const qty = hasOptions ? qtyOfMeal(m.id) : (sel[keyOf(m.id, [])]?.qty || 0);
              const lines = hasOptions ? Object.values(sel).filter((l) => l.mealId === m.id) : [];
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
                  {hasOptions ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => openChooser(m)}
                        disabled={!canModify}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium border disabled:opacity-40"
                        style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                      >
                        <Plus size={13} /> {qty > 0 ? `Add another (${qty})` : "Customize"}
                      </button>
                      {lines.map((l) => (
                        <div key={keyOf(l.mealId, l.optionIds)} className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--ink-soft)" }}>
                          <span className="truncate max-w-[180px]">{labelOf(l).replace(`${m.name} `, "")}{deltaOf(l) ? ` +${formatCents(deltaOf(l))}` : ""}</span>
                          <button onClick={() => setQty(l.mealId, -1, l.optionIds)} disabled={!canModify} aria-label="Remove one"><Minus size={12} /></button>
                          <span className="font-semibold w-3 text-center" style={{ color: "var(--ink)" }}>{l.qty}</span>
                          <button onClick={() => setQty(l.mealId, 1, l.optionIds)} disabled={!canModify} aria-label="Add one"><Plus size={12} /></button>
                        </div>
                      ))}
                    </div>
                  ) : qty === 0 ? (
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

      {/* Build-your-own chooser */}
      {chooser && (() => {
        const cm = mealById.get(chooser.mealId);
        if (!cm) return null;
        const r = resolveSelections(cm.optionGroups ?? [], Object.values(chooser.picks).flat());
        const delta = r.ok ? r.priceDeltaCents : 0;
        const toggle = (g: ManagerOptionGroup, optId: string) =>
          setChooser((c) => {
            if (!c) return c;
            const cur = c.picks[g.id] ?? [];
            let next: string[];
            if (g.maxSelect <= 1) next = cur[0] === optId && g.minSelect === 0 ? [] : [optId];
            else next = cur.includes(optId) ? cur.filter((x) => x !== optId) : cur.length < g.maxSelect ? [...cur, optId] : cur;
            return { ...c, picks: { ...c.picks, [g.id]: next }, error: null };
          });
        return (
          <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(31,30,26,.45)" }} onClick={() => setChooser(null)}>
            <div className="w-full max-w-md rounded-2xl border p-5 max-h-[90vh] overflow-auto" style={{ ...cardStyle, background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>{cm.name}</h3>
                  <p className="text-[12px]" style={{ color: "var(--muted)" }}>Make it yours{delta ? ` · +${formatCents(delta)} billed with your next payment` : ""}</p>
                </div>
                <button onClick={() => setChooser(null)} aria-label="Close" className="text-[18px] leading-none px-1" style={{ color: "var(--muted)" }}>×</button>
              </div>
              <div className="space-y-4">
                {(cm.optionGroups ?? []).map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>{g.name}</span>
                      <span className="text-[11px]" style={{ color: "var(--muted)" }}>{g.maxSelect <= 1 ? (g.minSelect ? "Pick one" : "Optional") : `Pick up to ${g.maxSelect}`}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.options.map((o) => {
                        const on = (chooser.picks[g.id] ?? []).includes(o.id);
                        return (
                          <button key={o.id} type="button" onClick={() => toggle(g, o.id)} aria-pressed={on} className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors" style={{ background: on ? "var(--pine)" : "transparent", color: on ? "#f4f2ec" : "var(--ink-soft)", borderColor: on ? "var(--pine)" : "var(--line)" }}>
                            {o.name}{o.priceDeltaCents ? ` +${formatCents(o.priceDeltaCents)}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {chooser.error && <p className="text-[12.5px] mt-3" style={{ color: "var(--clay)" }}>{chooser.error}</p>}
              <button onClick={confirmChooser} className="w-full mt-4 py-2.5 rounded-lg text-[14px] font-medium flex items-center justify-center gap-2" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
                <Plus size={15} /> Add to my box
              </button>
            </div>
          </div>
        );
      })()}

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

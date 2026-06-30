"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { formatCents } from "@/lib/money";
import {
  pauseSubscription,
  resumeSubscription,
  skipNextDelivery,
  updateSelection,
} from "./actions";

export type ManagerMeal = { id: string; name: string; priceCents: number; diet: string | null };

export function SubscriptionManager({
  subscriptionId,
  status,
  planName,
  frequencyLabel,
  nextDeliveryLabel,
  cutoffLabel,
  canModify,
  perMealPriceCents,
  initialSelection,
  meals,
}: {
  subscriptionId: string;
  status: "active" | "paused" | "canceled";
  planName: string;
  frequencyLabel: string;
  nextDeliveryLabel: string;
  cutoffLabel: string;
  canModify: boolean;
  perMealPriceCents: number;
  initialSelection: Record<string, number>;
  meals: ManagerMeal[];
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const [sel, setSel] = useState<Record<string, number>>(initialSelection);
  const [dirty, setDirty] = useState(false);

  const flash = (r: { ok: boolean; message: string }) => {
    setToast(r);
    setTimeout(() => setToast(null), 3000);
  };

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => flash(await fn()));

  const setQty = (id: string, delta: number) => {
    setSel((cur) => {
      const n = Math.max(0, (cur[id] || 0) + delta);
      const x = { ...cur };
      if (n === 0) delete x[id];
      else x[id] = n;
      return x;
    });
    setDirty(true);
  };

  const totalMeals = Object.values(sel).reduce((a, b) => a + b, 0);
  const cycleCents = totalMeals * perMealPriceCents;

  const saveSelection = () =>
    startTransition(async () => {
      const r = await updateSelection({
        subscriptionId,
        items: Object.entries(sel).map(([mealId, qty]) => ({ mealId, qty })),
      });
      flash(r);
      if (r.ok) setDirty(false);
    });

  const paused = status === "paused";

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className="fade px-4 py-2.5 rounded-lg text-[13px] flex items-center gap-2"
          style={{
            background: toast.ok
              ? "color-mix(in srgb, var(--pine) 9%, transparent)"
              : "color-mix(in srgb, var(--clay) 10%, transparent)",
            color: toast.ok ? "var(--pine)" : "var(--clay)",
            border: `1px solid ${toast.ok ? "color-mix(in srgb, var(--pine) 20%, transparent)" : "var(--clay)"}`,
          }}
        >
          {toast.ok ? <Check size={15} /> : null}
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
      </div>

      {/* Meal selection editor */}
      <div className="rounded-xl border p-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
            Meals for your next delivery
          </h3>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>
            {totalMeals} meals · {formatCents(cycleCents)}
          </span>
        </div>
        {!canModify && (
          <p
            className="text-[12px] mb-3 mt-2 px-3 py-2 rounded-md flex items-center gap-1.5"
            style={{ background: "var(--sand)", color: "var(--muted)" }}
          >
            <Lock size={12} /> Editing is locked — you&apos;re past the cut-off or paused.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
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
              disabled={pending || !dirty || totalMeals === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              <Check size={15} /> {pending ? "Saving…" : "Save meals"}
            </button>
            {dirty && (
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                Unsaved changes
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(31,30,26,.03)",
} as const;

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Pencil, Trash2, Check, Plus, X } from "lucide-react";
import { formatCents } from "@/lib/money";
import { savePlan, togglePlanActive, deletePlan } from "./actions";

export type PlanRow = {
  id: string;
  name: string;
  mealsPerWeek: number;
  perMealPriceCents: number;
  active: boolean;
  subscriberCount: number;
};

const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;
const input = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export function PlansManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [name, setName] = useState("");
  const [meals, setMeals] = useState("");
  const [price, setPrice] = useState("");

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const reset = () => {
    setEditing(null);
    setName("");
    setMeals("");
    setPrice("");
  };

  const startEdit = (p: PlanRow) => {
    setEditing(p);
    setName(p.name);
    setMeals(String(p.mealsPerWeek));
    setPrice((p.perMealPriceCents / 100).toFixed(2));
  };

  const submit = () =>
    startTransition(async () => {
      const r = await savePlan({
        id: editing?.id,
        name,
        mealsPerWeek: Number(meals),
        perMealPrice: Number(price),
      });
      flash(r.message ?? (r.ok ? "Saved." : "Something went wrong."));
      if (r.ok) {
        reset();
        router.refresh();
      }
    });

  const toggle = (id: string) =>
    startTransition(async () => {
      await togglePlanActive(id);
      router.refresh();
    });

  const remove = (p: PlanRow) => {
    const msg =
      p.subscriberCount > 0
        ? `"${p.name}" has ${p.subscriberCount} subscriber(s), so it will be deactivated (not deleted). Continue?`
        : `Delete "${p.name}"?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      await deletePlan(p.id);
      flash(p.subscriberCount > 0 ? "Plan deactivated." : "Plan deleted.");
      router.refresh();
    });
  };

  const weekly = (p: { mealsPerWeek: number; perMealPriceCents: number }) =>
    formatCents(p.mealsPerWeek * p.perMealPriceCents);
  const previewWeekly =
    Number(meals) > 0 && Number(price) >= 0 ? formatCents(Math.round(Number(meals) * Number(price) * 100)) : null;

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className="fade px-4 py-2.5 rounded-lg text-[13px] flex items-center gap-2"
          style={{ background: "color-mix(in srgb, var(--pine) 9%, transparent)", color: "var(--pine)", border: "1px solid color-mix(in srgb, var(--pine) 20%, transparent)" }}
        >
          <Check size={15} /> {toast}
        </div>
      )}

      {/* Create / edit form */}
      <div className="rounded-xl border p-5" style={card}>
        <div className="flex items-center gap-2 mb-4">
          <Repeat size={16} style={{ color: "var(--pine)" }} />
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
            {editing ? `Edit “${editing.name}”` : "Create a plan"}
          </h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>Plan name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Athlete · 12 meals/week"
              className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
              style={input}
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>Meals per week</label>
            <input
              value={meals}
              onChange={(e) => setMeals(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="12"
              className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
              style={input}
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>Price per meal ($)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="12.50"
              className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
              style={input}
            />
          </div>
          <div className="flex items-end">
            <div className="text-[13px]" style={{ color: "var(--muted)" }}>
              {previewWeekly ? (
                <>Weekly total <span className="font-semibold" style={{ color: "var(--ink)" }}>{previewWeekly}</span></>
              ) : (
                "Weekly total shows here"
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={submit}
            disabled={pending || !name.trim() || !meals || price === ""}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            {editing ? <Check size={15} /> : <Plus size={15} />}
            {pending ? "Saving…" : editing ? "Save changes" : "Create plan"}
          </button>
          {editing && (
            <button onClick={reset} disabled={pending} className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--muted)" }}>
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Existing plans */}
      {plans.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-[13.5px]" style={{ ...card, color: "var(--muted)" }}>
          No plans yet. Create your first subscription plan above — it&apos;ll appear on your storefront.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border p-5" style={card}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{p.name}</div>
                  <div className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {p.mealsPerWeek} meals/week · {formatCents(p.perMealPriceCents)}/meal
                  </div>
                </div>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={
                    p.active
                      ? { background: "color-mix(in srgb, var(--pine) 12%, transparent)", color: "var(--pine)" }
                      : { background: "var(--sand)", color: "var(--muted)" }
                  }
                >
                  {p.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--line)" }}>
                <div className="text-[13px]">
                  <span className="disp text-[18px] font-medium" style={{ color: "var(--pine)" }}>{weekly(p)}</span>
                  <span style={{ color: "var(--muted)" }}> /week</span>
                  {p.subscriberCount > 0 && (
                    <span className="text-[12px] ml-2" style={{ color: "var(--muted)" }}>· {p.subscriberCount} subscriber{p.subscriberCount === 1 ? "" : "s"}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(p)} disabled={pending} title="Edit" className="p-1.5 rounded-md" style={{ color: "var(--ink)" }}>
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => toggle(p.id)} disabled={pending} className="text-[12px] font-medium px-2 py-1 rounded-md border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => remove(p)} disabled={pending} title="Delete" className="p-1.5 rounded-md" style={{ color: "var(--clay)" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

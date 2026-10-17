"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Send, Loader2 } from "lucide-react";
import { formatCents } from "@/lib/money";
import { submitCateringRequest } from "../../catering-actions";

type MealOpt = { id: string; name: string; priceCents: number; diet: string | null; isAddOn: boolean };

const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;
const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;
const INP = "w-full px-3 py-2 rounded-md border text-[13.5px] outline-none";

export function CateringForm({
  slug,
  meals,
  minDate,
  minMeals,
  fulfillment,
  pickupLocations,
}: {
  slug: string;
  meals: MealOpt[];
  minDate: string;
  minMeals: number;
  fulfillment: "delivery" | "pickup" | "both";
  pickupLocations: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"delivery" | "pickup">(fulfillment === "pickup" ? "pickup" : "delivery");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", eventDate: minDate, eventTime: "", headcount: "", address: "", notes: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + d) }));

  const mealCount = useMemo(() => Object.values(qty).reduce((s, n) => s + n, 0), [qty]);
  const estimate = useMemo(() => meals.reduce((s, m) => s + (qty[m.id] || 0) * m.priceCents, 0), [meals, qty]);

  const submit = () => {
    setError(null);
    start(async () => {
      const r = await submitCateringRequest({
        slug,
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        eventDate: form.eventDate,
        eventTime: form.eventTime,
        headcount: form.headcount ? Number(form.headcount) : undefined,
        fulfillment: mode,
        address: mode === "delivery" ? form.address : "",
        notes: form.notes,
        items: Object.entries(qty).filter(([, n]) => n > 0).map(([mealId, n]) => ({ mealId, qty: n })),
      });
      if (r.ok) router.push(`/store/${slug}/catering/${r.token}`);
      else setError({ message: r.message, field: r.field });
    });
  };

  const err = (field: string) => (error?.field === field ? <p className="text-[11.5px] mt-1" style={{ color: "var(--clay)" }}>{error.message}</p> : null);

  return (
    <div className="grid lg:grid-cols-[1.25fr_1fr] gap-5 mt-7 items-start">
      <div className="space-y-4">
        {/* Event */}
        <section className="rounded-xl border p-5" style={card}>
          <h2 className="text-[15px] font-semibold mb-3" style={{ color: "var(--ink)" }}>The event</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Date</span>
              <input type="date" min={minDate} value={form.eventDate} onChange={set("eventDate")} className={INP} style={inputStyle} />
              {err("eventDate")}
            </label>
            <label className="block">
              <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Time (optional)</span>
              <input value={form.eventTime} onChange={set("eventTime")} placeholder="11:30 AM" className={INP} style={inputStyle} />
            </label>
            <label className="block">
              <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>How many people?</span>
              <input type="number" min={0} inputMode="numeric" value={form.headcount} onChange={set("headcount")} placeholder="40" className={INP} style={inputStyle} />
            </label>
          </div>
          {fulfillment === "both" && (
            <div className="flex gap-2 mt-4">
              {(["delivery", "pickup"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className="px-3 py-1.5 rounded-md text-[13px] font-medium border" style={{ borderColor: mode === m ? "var(--pine)" : "var(--line)", background: mode === m ? "color-mix(in srgb, var(--pine) 10%, transparent)" : "var(--paper)", color: "var(--ink)" }}>
                  {m === "delivery" ? "Deliver to us" : "We'll pick up"}
                </button>
              ))}
            </div>
          )}
          {mode === "delivery" ? (
            <label className="block mt-4">
              <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Delivery address</span>
              <input value={form.address} onChange={set("address")} placeholder="Street, city, buzzer or suite" className={INP} style={inputStyle} />
              {err("address")}
            </label>
          ) : pickupLocations.length > 0 ? (
            <p className="text-[12.5px] mt-4" style={{ color: "var(--muted)" }}>Pickup from {pickupLocations.join(" or ")}.</p>
          ) : null}
        </section>

        {/* Meals */}
        <section className="rounded-xl border p-5" style={card}>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>What would you like?</h2>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>{mealCount} meal{mealCount === 1 ? "" : "s"} · from {formatCents(estimate)}</span>
          </div>
          <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>Pick from the menu, or skip this and describe it below — the kitchen prices either way.</p>
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {meals.map((m) => {
              const n = qty[m.id] || 0;
              return (
                <div key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{m.name}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{formatCents(m.priceCents)}{m.diet ? ` · ${m.diet}` : ""}{m.isAddOn ? " · add-on" : ""}</div>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded-md" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                    <button type="button" onClick={() => bump(m.id, -5)} aria-label="Remove five" className="text-[11px] font-semibold px-1" style={{ color: "var(--muted)" }}>−5</button>
                    <button type="button" onClick={() => bump(m.id, -1)} aria-label="Remove one"><Minus size={14} style={{ color: "var(--ink)" }} /></button>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={n || ""}
                      placeholder="0"
                      onChange={(e) => setQty((q) => ({ ...q, [m.id]: Math.max(0, Math.min(5000, Number(e.target.value) || 0)) }))}
                      className="w-12 text-center text-[13px] font-semibold bg-transparent outline-none"
                      style={{ color: "var(--ink)" }}
                    />
                    <button type="button" onClick={() => bump(m.id, 1)} aria-label="Add one"><Plus size={14} style={{ color: "var(--ink)" }} /></button>
                    <button type="button" onClick={() => bump(m.id, 5)} aria-label="Add five" className="text-[11px] font-semibold px-1" style={{ color: "var(--muted)" }}>+5</button>
                  </div>
                </div>
              );
            })}
          </div>
          {err("items")}
          <label className="block mt-4">
            <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Anything else? Dietary needs, trays vs boxes, budget, set-up…</span>
            <textarea value={form.notes} onChange={set("notes")} rows={3} className={INP} style={inputStyle} placeholder="e.g. 40 boxed lunches, 6 vegetarian, 2 gluten-free; delivered to the 3rd-floor boardroom by 11:30." />
          </label>
        </section>
      </div>

      {/* Contact + submit */}
      <aside className="lg:sticky lg:top-6 rounded-xl border p-5 space-y-3" style={card}>
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Your details</h2>
        <label className="block">
          <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Name</span>
          <input value={form.name} onChange={set("name")} className={INP} style={inputStyle} autoComplete="name" />
          {err("name")}
        </label>
        <label className="block">
          <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Email</span>
          <input type="email" value={form.email} onChange={set("email")} className={INP} style={inputStyle} autoComplete="email" />
          {err("email")}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Phone</span>
            <input value={form.phone} onChange={set("phone")} className={INP} style={inputStyle} autoComplete="tel" />
          </label>
          <label className="block">
            <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Company (optional)</span>
            <input value={form.company} onChange={set("company")} className={INP} style={inputStyle} autoComplete="organization" />
          </label>
        </div>
        {error && !error.field && <p className="text-[12.5px]" style={{ color: "var(--clay)" }}>{error.message}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full py-3 rounded-lg text-[14.5px] font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "var(--pine)", color: "#f4f2ec" }}
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Request a quote
        </button>
        <p className="text-[11.5px] leading-snug" style={{ color: "var(--muted)" }}>
          No payment now. You&apos;ll get a quote by email to approve; the date is confirmed once it&apos;s paid. Minimum {minMeals} meals.
        </p>
      </aside>
    </div>
  );
}

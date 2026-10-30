"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Send, Loader2, Users } from "lucide-react";
import { formatCents } from "@/lib/money";
import { DIETARY_KEYS, DIETARY_LABEL, type DietaryKey } from "@/lib/catering-terms";
import { submitCateringRequest } from "../../catering-actions";

type MealOpt = { id: string; name: string; priceCents: number; diet: string | null; isAddOn: boolean; perGuest: boolean };

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
  const [packages, setPackages] = useState<Record<string, boolean>>({});
  const [dietary, setDietary] = useState<Partial<Record<DietaryKey, string>>>({});
  const [mode, setMode] = useState<"delivery" | "pickup">(fulfillment === "pickup" ? "pickup" : "delivery");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", eventDate: minDate, eventTime: "", deliveryWindow: "", headcount: "", address: "", notes: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + d) }));

  const headcount = Math.max(0, Number(form.headcount) || 0);
  const perGuest = meals.filter((m) => m.perGuest);
  const regular = meals.filter((m) => !m.perGuest);
  const mealCount = useMemo(() => Object.values(qty).reduce((s, n) => s + n, 0) + perGuest.filter((m) => packages[m.id]).length * headcount, [qty, packages, perGuest, headcount]);
  const estimate = useMemo(
    () => regular.reduce((s, m) => s + (qty[m.id] || 0) * m.priceCents, 0) + perGuest.filter((m) => packages[m.id]).reduce((s, m) => s + headcount * m.priceCents, 0),
    [regular, perGuest, qty, packages, headcount],
  );

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
        deliveryWindow: mode === "delivery" ? form.deliveryWindow : "",
        headcount: headcount || undefined,
        fulfillment: mode,
        address: mode === "delivery" ? form.address : "",
        notes: form.notes,
        dietary: Object.fromEntries(DIETARY_KEYS.filter((k) => Number(dietary[k]) > 0).map((k) => [k, Number(dietary[k])])),
        items: [
          ...Object.entries(qty).filter(([, n]) => n > 0).map(([mealId, n]) => ({ mealId, qty: n })),
          ...perGuest.filter((m) => packages[m.id]).map((m) => ({ mealId: m.id, qty: Math.max(1, headcount) })),
        ],
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
              <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Start time (optional)</span>
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
            <div className="grid sm:grid-cols-[1fr_160px] gap-3 mt-4">
              <label className="block">
                <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Delivery address</span>
                <input value={form.address} onChange={set("address")} placeholder="Street, city, buzzer or suite" className={INP} style={inputStyle} />
                {err("address")}
              </label>
              <label className="block">
                <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Arrive between</span>
                <input value={form.deliveryWindow} onChange={set("deliveryWindow")} placeholder="11:00–11:30" className={INP} style={inputStyle} />
              </label>
            </div>
          ) : pickupLocations.length > 0 ? (
            <p className="text-[12.5px] mt-4" style={{ color: "var(--muted)" }}>Pickup from {pickupLocations.join(" or ")}.</p>
          ) : null}

          {/* Dietary counts: feed the event sheet and production */}
          <div className="mt-4">
            <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Dietary needs (how many of each, if any)</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DIETARY_KEYS.map((k) => (
                <label key={k} className="block">
                  <span className="text-[11px] block mb-1" style={{ color: "var(--muted)" }}>{DIETARY_LABEL[k]}</span>
                  <input type="number" min={0} inputMode="numeric" value={dietary[k] ?? ""} onChange={(e) => setDietary((d) => ({ ...d, [k]: e.target.value }))} placeholder="0" className="w-full px-2 py-1.5 rounded-md border text-[13px] outline-none" style={inputStyle} />
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Packages (per guest) */}
        {perGuest.length > 0 && (
          <section className="rounded-xl border p-5" style={card}>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Packages, priced per guest</h2>
              <span className="text-[12px] inline-flex items-center gap-1" style={{ color: "var(--muted)" }}><Users size={12} /> {headcount || "—"} guests</span>
            </div>
            <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>Tick a package and we price it for everyone in your headcount.</p>
            <div className="divide-y" style={{ borderColor: "var(--line)" }}>
              {perGuest.map((m) => (
                <label key={m.id} className="flex items-center gap-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={!!packages[m.id]} onChange={(e) => setPackages((p) => ({ ...p, [m.id]: e.target.checked }))} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{m.name}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{formatCents(m.priceCents)} a head{m.diet ? ` · ${m.diet}` : ""}</div>
                  </div>
                  {packages[m.id] && headcount > 0 && <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{formatCents(m.priceCents * headcount)}</span>}
                </label>
              ))}
            </div>
            {perGuest.some((m) => packages[m.id]) && headcount === 0 && <p className="text-[11.5px] mt-2" style={{ color: "var(--clay)" }}>Enter how many people above so we can price the package.</p>}
          </section>
        )}

        {/* Meals */}
        <section className="rounded-xl border p-5" style={card}>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{perGuest.length ? "Or pick individual items" : "What would you like?"}</h2>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>{mealCount} meal{mealCount === 1 ? "" : "s"} · from {formatCents(estimate)}</span>
          </div>
          <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>Pick from the menu, or skip this and describe it below — the kitchen prices either way.</p>
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {regular.map((m) => {
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
            <span className="text-[12.5px] font-medium block mb-1.5" style={{ color: "var(--ink)" }}>Anything else? Trays vs boxes, budget, set-up, allergies…</span>
            <textarea value={form.notes} onChange={set("notes")} rows={3} className={INP} style={inputStyle} placeholder="e.g. 40 boxed lunches delivered to the 3rd-floor boardroom; two severe nut allergies; we have no fridge on site." />
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
          No payment now. You&apos;ll get a quote by email to approve; the date is confirmed once it&apos;s paid or invoiced. Minimum {minMeals} meals.
        </p>
      </aside>
    </div>
  );
}

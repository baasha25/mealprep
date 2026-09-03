"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  UtensilsCrossed,
  Star,
  ListOrdered,
  Search,
} from "lucide-react";
import { formatCents } from "@/lib/money";
import { toggleMealActive, deleteMeal } from "./actions";

export type MenuMeal = {
  id: string;
  name: string;
  priceCents: number;
  swatch: string;
  imageUrl: string | null;
  diet: string | null;
  calories: number;
  active: boolean;
  ingredientCount: number;
  reviewCount: number;
  rating: number;
  stepCount: number;
};

type Tab = "on" | "retired" | "all";

/**
 * The kitchen's recipe library. Every meal is a saved recipe; retiring one
 * (Hide) keeps its ingredients, method and costs intact, so it can be brought
 * back later. Tabs + search make a large library easy to work through.
 */
export function MenuLibrary({ meals }: { meals: MenuMeal[] }) {
  const [tab, setTab] = useState<Tab>("on");
  const [q, setQ] = useState("");

  const onCount = meals.filter((m) => m.active).length;
  const retiredCount = meals.length - onCount;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return meals.filter((m) => {
      if (tab === "on" && !m.active) return false;
      if (tab === "retired" && m.active) return false;
      if (!needle) return true;
      return (
        m.name.toLowerCase().includes(needle) ||
        (m.diet ?? "").toLowerCase().includes(needle)
      );
    });
  }, [meals, tab, q]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "on", label: "On menu", count: onCount },
    { key: "retired", label: "Retired", count: retiredCount },
    { key: "all", label: "All recipes", count: meals.length },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div
          className="inline-flex rounded-lg border p-0.5"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors"
              style={{
                background: tab === t.key ? "var(--pine)" : "transparent",
                color: tab === t.key ? "#f4f2ec" : "var(--muted)",
              }}
            >
              {t.label}{" "}
              <span style={{ opacity: 0.75 }}>({t.count})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes…"
            className="pl-8 pr-3 py-2 rounded-lg text-[13px] w-56 max-w-full border outline-none"
            style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <UtensilsCrossed size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            {q.trim()
              ? "No recipes match your search."
              : tab === "retired"
                ? "No retired recipes yet. Hidden meals land here, kept for later."
                : "No meals yet."}
          </p>
          {!q.trim() && tab !== "retired" && (
            <Link
              href="/dashboard/menu/new"
              className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-2 rounded-lg text-[13px] font-medium"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              <Plus size={15} /> Add your first meal
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border overflow-hidden flex flex-col"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                boxShadow: "0 1px 2px rgba(31,30,26,.03)",
                opacity: m.active ? 1 : 0.72,
              }}
            >
              <div className="h-20 relative" style={{ background: `${m.swatch}1a` }}>
                {m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imageUrl}
                    alt={m.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {!m.active && (
                  <span
                    className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "var(--sand)", color: "var(--muted)" }}
                  >
                    Retired
                  </span>
                )}
                {m.stepCount > 0 && (
                  <span
                    className="absolute top-2 right-2 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "var(--surface)", color: "var(--pine)" }}
                    title={`${m.stepCount} recipe step${m.stepCount === 1 ? "" : "s"}`}
                  >
                    <ListOrdered size={10} /> {m.stepCount}
                  </span>
                )}
              </div>
              <div className="p-3.5 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                    {m.name}
                  </span>
                  <span className="disp text-[14px] font-medium shrink-0" style={{ color: "var(--ink)" }}>
                    {formatCents(m.priceCents)}
                  </span>
                </div>
                <div
                  className="text-[12px] mb-3 flex items-center gap-2 flex-wrap"
                  style={{ color: "var(--muted)" }}
                >
                  {m.reviewCount > 0 && (
                    <span className="flex items-center gap-0.5" style={{ color: "#c98a2b" }}>
                      <Star size={11} fill="#e0a53f" style={{ color: "#e0a53f" }} />
                      {m.rating.toFixed(1)}
                      <span style={{ color: "var(--muted)" }}>({m.reviewCount})</span>
                    </span>
                  )}
                  <span>
                    {m.diet ? `${m.diet} · ` : ""}
                    {m.calories} cal · {m.ingredientCount} ingredient
                    {m.ingredientCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div
                  className="flex items-center gap-1.5 mt-auto pt-2 border-t"
                  style={{ borderColor: "var(--line)" }}
                >
                  <Link
                    href={`/dashboard/menu/${m.id}/edit`}
                    className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-md"
                    style={{ background: "var(--paper)", color: "var(--ink)" }}
                  >
                    <Pencil size={12} /> Edit
                  </Link>
                  <form action={toggleMealActive}>
                    <input type="hidden" name="mealId" value={m.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-md"
                      style={{
                        background: m.active ? "var(--paper)" : "color-mix(in srgb, var(--pine) 12%, transparent)",
                        color: m.active ? "var(--ink)" : "var(--pine)",
                      }}
                    >
                      {m.active ? <EyeOff size={12} /> : <Eye size={12} />}
                      {m.active ? "Retire" : "Restore"}
                    </button>
                  </form>
                  <form action={deleteMeal} className="ml-auto">
                    <input type="hidden" name="mealId" value={m.id} />
                    <button
                      type="submit"
                      className="grid place-items-center w-7 h-7 rounded-md"
                      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
                      aria-label={`Delete ${m.name}`}
                    >
                      <Trash2 size={12} style={{ color: "var(--clay)" }} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Check,
  Plus,
  Trash2,
  UtensilsCrossed,
  Wheat,
  Milk,
  Nut,
  Fish,
  type LucideIcon,
} from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { DIET_OPTS, ALLERGENS, UNITS } from "@/lib/menu-constants";
import type { MealActionState } from "./actions";

const ALLERGEN_ICON: Record<string, LucideIcon> = {
  gluten: Wheat,
  dairy: Milk,
  nuts: Nut,
  fish: Fish,
};

export type IngredientRow = {
  name: string;
  qty: string;
  unit: string;
  trimPercent: string;
};

export type MealFormInitial = {
  name: string;
  description: string;
  diet: string | null;
  price: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  allergens: string[];
  active: boolean;
  swatch: string;
  ingredients: IngredientRow[];
};

const inputStyle = {
  borderColor: "var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
} as const;

export function MealForm({
  action,
  initial,
  submitLabel,
}: {
  action: (
    prev: MealActionState,
    formData: FormData,
  ) => Promise<MealActionState>;
  initial: MealFormInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<
    MealActionState,
    FormData
  >(action, { ok: false });
  const errors = state.errors ?? {};

  const [diet, setDiet] = useState<string | null>(initial.diet);
  const [allergens, setAllergens] = useState<string[]>(initial.allergens);
  const [rows, setRows] = useState<IngredientRow[]>(
    initial.ingredients.length
      ? initial.ingredients
      : [{ name: "", qty: "", unit: "oz", trimPercent: "" }],
  );

  const toggleAllergen = (a: string) =>
    setAllergens((cur) =>
      cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a],
    );
  const updRow = (i: number, k: keyof IngredientRow, v: string) =>
    setRows((cur) => cur.map((r, x) => (x === i ? { ...r, [k]: v } : r)));
  const addRow = () =>
    setRows((cur) => [...cur, { name: "", qty: "", unit: "oz", trimPercent: "" }]);
  const remRow = (i: number) =>
    setRows((cur) => cur.filter((_, x) => x !== i));

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden, client-controlled fields */}
      <input type="hidden" name="diet" value={diet ?? ""} />
      {allergens.map((a) => (
        <input key={a} type="hidden" name="allergens" value={a} />
      ))}

      <Card>
        <CardTitle
          icon={<UtensilsCrossed size={15} />}
          title="Details"
          note="Appears live in the storefront"
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Meal name">
            <input
              name="name"
              defaultValue={initial.name}
              placeholder="BBQ Chicken Bowl"
              className={INP}
              style={inputStyle}
            />
            {errors.name && (
              <p className="text-[11.5px] mt-1" style={{ color: "var(--clay)" }}>
                {errors.name}
              </p>
            )}
          </Field>
          <Field label="Price ($)">
            <input
              name="price"
              type="number"
              step="0.01"
              defaultValue={initial.price}
              placeholder="12.50"
              className={INP}
              style={inputStyle}
            />
            {errors.price && (
              <p className="text-[11.5px] mt-1" style={{ color: "var(--clay)" }}>
                {errors.price}
              </p>
            )}
          </Field>
        </div>
        <Field label="Short description" className="mt-4">
          <input
            name="description"
            defaultValue={initial.description}
            placeholder="One line customers see on the card"
            className={INP}
            style={inputStyle}
          />
        </Field>
        <Field label="Diet category" className="mt-4">
          <div className="flex gap-1.5 flex-wrap">
            {DIET_OPTS.map((d) => {
              const on = diet === d;
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDiet(on ? null : d)}
                  className="px-3 py-1.5 rounded-md text-[12.5px] border"
                  style={{
                    background: on ? "var(--ink)" : "transparent",
                    color: on ? "#f4f2ec" : "var(--ink-soft)",
                    borderColor: on ? "var(--ink)" : "var(--line)",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="mt-4">
          <label
            className="text-[12.5px] font-medium"
            style={{ color: "var(--ink)" }}
          >
            Nutrition (per meal)
          </label>
          <div className="grid grid-cols-4 gap-3 mt-1.5">
            {(
              [
                ["calories", "Calories"],
                ["proteinG", "Protein g"],
                ["carbsG", "Carbs g"],
                ["fatG", "Fat g"],
              ] as const
            ).map(([k, l]) => (
              <div key={k}>
                <input
                  name={k}
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={initial[k]}
                  placeholder="0"
                  className={INP}
                  style={inputStyle}
                />
                <div
                  className="text-[11px] mt-1 text-center"
                  style={{ color: "var(--muted)" }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Field label="Allergens" className="mt-4">
          <div className="flex gap-1.5 flex-wrap">
            {ALLERGENS.map((a) => {
              const I = ALLERGEN_ICON[a];
              const on = allergens.includes(a);
              return (
                <button
                  type="button"
                  key={a}
                  onClick={() => toggleAllergen(a)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] border capitalize"
                  style={{
                    background: on ? "var(--clay)" : "transparent",
                    color: on ? "#f4f2ec" : "var(--ink-soft)",
                    borderColor: on ? "var(--clay)" : "var(--line)",
                  }}
                >
                  <I size={13} />
                  {a}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="mt-4 flex items-center gap-4">
          <Field label="Card color">
            <input
              type="color"
              name="swatch"
              defaultValue={initial.swatch}
              className="h-9 w-12 rounded-md border cursor-pointer"
              style={{ borderColor: "var(--line)" }}
            />
          </Field>
          <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
            <input type="checkbox" name="active" defaultChecked={initial.active} />
            <span className="text-[13px]" style={{ color: "var(--ink)" }}>
              Active (visible in storefront)
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle
          icon={<UtensilsCrossed size={15} />}
          title="Ingredients"
          note="Trim % powers the zero-waste shopping list"
        />
        <div className="space-y-2">
          {rows.map((ing, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_68px_82px_72px_auto] gap-2 items-center"
            >
              <input
                name="ingName"
                value={ing.name}
                onChange={(e) => updRow(i, "name", e.target.value)}
                placeholder="Ingredient"
                className={INP}
                style={inputStyle}
              />
              <input
                name="ingQty"
                type="number"
                step="0.01"
                min="0"
                value={ing.qty}
                onChange={(e) => updRow(i, "qty", e.target.value)}
                placeholder="Qty"
                className={INP}
                style={inputStyle}
              />
              <select
                name="ingUnit"
                value={ing.unit}
                onChange={(e) => updRow(i, "unit", e.target.value)}
                className={INP}
                style={inputStyle}
              >
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <input
                name="ingTrim"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={ing.trimPercent}
                onChange={(e) => updRow(i, "trimPercent", e.target.value)}
                placeholder="Trim%"
                className={INP}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => remRow(i)}
                className="grid place-items-center w-8 h-8 rounded-md"
                style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
                aria-label="Remove ingredient"
              >
                <Trash2 size={14} style={{ color: "var(--clay)" }} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 flex items-center gap-1 text-[12.5px] font-medium"
          style={{ color: "var(--pine)" }}
        >
          <Plus size={13} /> Add ingredient
        </button>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium disabled:opacity-60"
          style={btnPrimary}
        >
          <Check size={15} /> {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/dashboard/menu"
          className="px-4 py-2.5 rounded-lg text-[13px] font-medium"
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          Cancel
        </Link>
        {!state.ok && state.message && (
          <span className="text-[13px]" style={{ color: "var(--clay)" }}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

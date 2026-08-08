"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  UtensilsCrossed,
  Wheat,
  Milk,
  Nut,
  Fish,
  type LucideIcon,
} from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { DIET_OPTS, ALLERGENS, UNITS } from "@/lib/menu-constants";
import { canConvert } from "@/lib/units";
import { mealMacrosFromRecipe, recipeHasNutrition } from "@/lib/nutrition";
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
  shelfLifeDays: string;
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
  ingredientOptions = [],
}: {
  action: (
    prev: MealActionState,
    formData: FormData,
  ) => Promise<MealActionState>;
  initial: MealFormInitial;
  submitLabel: string;
  /** Existing ingredients to autocomplete against, so a recipe reuses a costed
   *  ingredient instead of creating a $0-cost duplicate. Unit + density let us
   *  flag rows whose unit can't be converted to how the ingredient is priced.
   *  Per-unit macros let us auto-sum the meal's nutrition from the recipe. */
  ingredientOptions?: {
    name: string;
    unit: string;
    densityGPerMl?: number | null;
    calPerUnit?: number;
    proteinPerUnit?: number;
    carbsPerUnit?: number;
    fatPerUnit?: number;
  }[];
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
  // Macro inputs are controlled so "Use these" (auto-sum from recipe) can fill them.
  const [macros, setMacros] = useState({
    calories: initial.calories,
    proteinG: initial.proteinG,
    carbsG: initial.carbsG,
    fatG: initial.fatG,
  });

  const toggleAllergen = (a: string) =>
    setAllergens((cur) =>
      cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a],
    );
  const updRow = (i: number, k: keyof IngredientRow, v: string) =>
    setRows((cur) => cur.map((r, x) => (x === i ? { ...r, [k]: v } : r)));

  // Existing-ingredient name → its unit + density, so picking a known ingredient
  // snaps the recipe to a compatible unit and we can flag rows that don't convert.
  const optMeta = new Map(ingredientOptions.map((o) => [o.name.toLowerCase(), o]));
  const optUnit = new Map(ingredientOptions.map((o) => [o.name.toLowerCase(), o.unit]));

  // Rows referencing a known ingredient whose unit can't be reconciled with how
  // it's priced (e.g. a lb-priced item measured in cups with no pack size set).
  const mismatches = rows.filter((r) => {
    const meta = optMeta.get(r.name.trim().toLowerCase());
    return meta && r.unit && !canConvert(r.unit, meta.unit, meta.densityGPerMl);
  });

  // Auto-sum nutrition from the recipe: for each row that references a known,
  // nutrition-carrying ingredient, convert the recipe qty into the ingredient's
  // unit and multiply by its per-unit macros. Mirrors the plate-cost math.
  const nutritionLines = rows
    .map((r) => {
      const meta = optMeta.get(r.name.trim().toLowerCase());
      if (!meta) return null;
      return {
        qty: Number(r.qty) || 0,
        unit: r.unit,
        ingredient: {
          unit: meta.unit,
          densityGPerMl: meta.densityGPerMl,
          calPerUnit: meta.calPerUnit ?? 0,
          proteinPerUnit: meta.proteinPerUnit ?? 0,
          carbsPerUnit: meta.carbsPerUnit ?? 0,
          fatPerUnit: meta.fatPerUnit ?? 0,
        },
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const canAutoNutrition = recipeHasNutrition(nutritionLines);
  const recipeMacros = canAutoNutrition ? mealMacrosFromRecipe(nutritionLines) : null;
  const applyRecipeMacros = () => {
    if (!recipeMacros) return;
    setMacros({
      calories: String(recipeMacros.calories),
      proteinG: String(recipeMacros.proteinG),
      carbsG: String(recipeMacros.carbsG),
      fatG: String(recipeMacros.fatG),
    });
  };
  const setIngName = (i: number, v: string) =>
    setRows((cur) =>
      cur.map((r, x) => {
        if (x !== i) return r;
        const unit = optUnit.get(v.trim().toLowerCase());
        return unit ? { ...r, name: v, unit } : { ...r, name: v };
      }),
    );
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
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-[12.5px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Nutrition (per meal)
            </label>
            {recipeMacros && (
              <button
                type="button"
                onClick={applyRecipeMacros}
                className="text-[11.5px] font-medium px-2.5 py-1 rounded-md border"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                title="Fill these fields by summing each ingredient's per-unit macros, converted to the recipe amounts."
              >
                Calc from recipe
              </button>
            )}
          </div>
          {recipeMacros && (
            <div
              className="text-[11.5px] mt-1.5 flex items-center gap-1.5"
              style={{ color: "var(--muted)" }}
            >
              <Info size={12} style={{ color: "var(--muted)" }} />
              <span>
                From recipe: {recipeMacros.calories} cal · {recipeMacros.proteinG}g P ·{" "}
                {recipeMacros.carbsG}g C · {recipeMacros.fatG}g F
              </span>
            </div>
          )}
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
                  value={macros[k]}
                  onChange={(e) =>
                    setMacros((cur) => ({ ...cur, [k]: e.target.value }))
                  }
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
          <Field label="Shelf life (days)">
            <input
              name="shelfLifeDays"
              type="number"
              step="1"
              min="1"
              max="60"
              defaultValue={initial.shelfLifeDays}
              placeholder="5"
              className={`${INP} w-24`}
              style={inputStyle}
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
        <p className="flex items-start gap-1.5 text-[11.5px] mb-2 -mt-1" style={{ color: "var(--muted)" }}>
          <Info size={13} style={{ marginTop: 1, flexShrink: 0, color: "var(--pine)" }} />
          <span>
            <strong>Pick an ingredient from the dropdown</strong> so the recipe uses its real cost &amp; unit — you can buy in lb and use in oz, it converts. Typing a brand-new name adds it at <strong>$0 cost</strong> until you price it in Inventory (which shows $0 / 100% margin).
          </span>
        </p>
        {/* Autocomplete source: existing costed ingredients for this kitchen. */}
        <datalist id="pf-ingredients">
          {ingredientOptions.map((o) => (
            <option key={o.name} value={o.name} />
          ))}
        </datalist>
        <div className="space-y-2">
          {rows.map((ing, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_68px_82px_72px_auto] gap-2 items-center"
            >
              <input
                name="ingName"
                value={ing.name}
                onChange={(e) => setIngName(i, e.target.value)}
                placeholder="Ingredient"
                list="pf-ingredients"
                autoComplete="off"
                title="Pick an existing ingredient from the list so the recipe uses its real cost & unit. A brand-new name is added at $0 cost until you price it in Inventory."
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
                title="Unit for this recipe amount. It can differ from how the ingredient is priced — the cost converts (e.g. buy per lb, use per oz)."
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
                title="Prep waste for this ingredient — peels, stalks, fat, ends. It grosses up how much you buy and shows the 'over-bought' dollars in Purchasing."
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

        {mismatches.length > 0 && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg text-[11.5px]" style={{ background: "#f3e9c9", color: "#7a5a1a" }}>
            <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              <strong>{[...new Set(mismatches.map((m) => m.name))].join(", ")}</strong>: this unit can&apos;t be converted to how the ingredient is priced (weight vs. volume). Use a matching unit, or set a &ldquo;grams per cup&rdquo; pack size on the ingredient in Inventory — otherwise its cost won&apos;t count correctly.
            </span>
          </div>
        )}
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

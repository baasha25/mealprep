"use client";

import { useActionState, useRef, useState } from "react";
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
  ImagePlus,
  Loader2,
  X,
  Calculator,
  type LucideIcon,
} from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { DIET_OPTS, ALLERGENS, UNITS } from "@/lib/menu-constants";
import { canConvert } from "@/lib/units";
import { mealMacrosFromRecipe, recipeHasNutrition } from "@/lib/nutrition";
import { signMealImageUpload, type MealActionState } from "./actions";

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
  imageUrl: string;
  shelfLifeDays: string;
  ingredients: IngredientRow[];
};

const inputStyle = {
  borderColor: "var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
} as const;

/**
 * Meal photo uploader. The file goes straight from the browser to Cloudinary
 * (signed on the server), and we keep only the returned URL in a hidden field
 * the form submits. Falls back to a clear "not set up" note when Cloudinary
 * isn't configured, so the form still works without it.
 */
function MealImageField({ initial }: { initial: string }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, or WebP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That image is over 8 MB. Please choose a smaller photo.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const sig = await signMealImageUpload();
      if (!sig.ok) {
        setError(sig.message);
        return;
      }
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("signature", sig.signature);
      body.append("folder", sig.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) {
        setError("Upload failed. Please try again.");
        return;
      }
      setUrl(data.secure_url as string);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <input type="hidden" name="imageUrl" value={url} />
      <label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
        Meal photo
      </label>
      <p className="text-[11.5px] mt-0.5 mb-2" style={{ color: "var(--muted)" }}>
        Shown big on your storefront — the #1 thing that sells a meal. Landscape or square,
        at least 1000px wide, JPG/PNG/WebP up to 8 MB. We optimize it automatically.
      </p>
      <div className="flex items-center gap-3">
        <div
          className="relative w-28 h-28 rounded-lg overflow-hidden grid place-items-center shrink-0"
          style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Meal" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus size={22} style={{ color: "var(--muted)" }} />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center" style={{ background: "#00000055" }}>
              <Loader2 size={20} className="animate-spin" color="#fff" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-60"
            style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}
          >
            <ImagePlus size={14} /> {busy ? "Uploading…" : url ? "Replace photo" : "Upload photo"}
          </button>
          {url && !busy && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: "var(--clay)" }}
            >
              <X size={13} /> Remove photo
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
      {error && (
        <p className="text-[11.5px] mt-2" style={{ color: "var(--clay)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

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

  // Trim calculator: which row's calculator is open, and its raw/after weights.
  // trim % = (raw − usable) ÷ raw × 100 — computed live, applied to the row.
  const [calcRow, setCalcRow] = useState<number | null>(null);
  const [calcRaw, setCalcRaw] = useState("");
  const [calcAfter, setCalcAfter] = useState("");
  const openCalc = (i: number) => {
    setCalcRow((cur) => (cur === i ? null : i));
    setCalcRaw("");
    setCalcAfter("");
  };
  const calcTrim: number | null = (() => {
    const raw = Number(calcRaw);
    const after = Number(calcAfter);
    if (!(raw > 0) || !(after >= 0) || after > raw) return null;
    return Math.round(((raw - after) / raw) * 1000) / 10; // one decimal
  })();

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
        <MealImageField initial={initial.imageUrl} />
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
        {/* Column headers so each field (esp. Trim %) is unambiguous. */}
        <div className="grid grid-cols-[1fr_68px_82px_72px_auto] gap-2 px-0.5 mb-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          <span>Ingredient</span>
          <span>Qty</span>
          <span>Unit</span>
          <span>Trim %</span>
          <span />
        </div>
        <div className="space-y-2">
          {rows.map((ing, i) => (
            <div key={i}>
              <div className="grid grid-cols-[1fr_68px_82px_72px_auto] gap-2 items-center">
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
                <div className="relative">
                  <input
                    name="ingTrim"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={ing.trimPercent}
                    onChange={(e) => updRow(i, "trimPercent", e.target.value)}
                    placeholder="0"
                    title="Prep waste for this ingredient — peels, stalks, fat, ends. It grosses up how much you buy and shows the 'over-bought' dollars in Purchasing. Not sure? Tap the calculator."
                    className={`${INP} pr-5`}
                    style={inputStyle}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none" style={{ color: "var(--muted)" }}>%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openCalc(i)}
                    className="grid place-items-center w-8 h-8 rounded-md"
                    style={{ background: calcRow === i ? "var(--pine)" : "var(--paper)", border: "1px solid var(--line)" }}
                    title="Work out the trim % from a raw vs. trimmed weight"
                    aria-label="Trim calculator"
                  >
                    <Calculator size={14} style={{ color: calcRow === i ? "#f4f2ec" : "var(--pine)" }} />
                  </button>
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
              </div>

              {/* Inline trim calculator for this row. */}
              {calcRow === i && (
                <div className="mt-2 rounded-lg p-3" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <div className="text-[11.5px] mb-2" style={{ color: "var(--ink)" }}>
                    <strong>Trim % calculator</strong> — weigh it before and after trimming. Trim % = (raw − usable) ÷ raw.
                  </div>
                  <div className="flex items-end gap-2 flex-wrap">
                    <label className="flex flex-col text-[11px]" style={{ color: "var(--muted)" }}>
                      Raw weight
                      <input type="number" step="0.01" min="0" value={calcRaw} onChange={(e) => setCalcRaw(e.target.value)} placeholder="e.g. 1000" className={`${INP} w-28`} style={inputStyle} />
                    </label>
                    <label className="flex flex-col text-[11px]" style={{ color: "var(--muted)" }}>
                      After trimming
                      <input type="number" step="0.01" min="0" value={calcAfter} onChange={(e) => setCalcAfter(e.target.value)} placeholder="e.g. 700" className={`${INP} w-28`} style={inputStyle} />
                    </label>
                    <div className="flex flex-col text-[11px]" style={{ color: "var(--muted)" }}>
                      Trim
                      <div className="h-9 flex items-center px-2 rounded-md text-[14px] font-semibold" style={{ color: calcTrim == null ? "var(--muted)" : "var(--pine)", minWidth: 56 }}>
                        {calcTrim == null ? "—" : `${calcTrim}%`}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={calcTrim == null}
                      onClick={() => {
                        if (calcTrim == null) return;
                        updRow(i, "trimPercent", String(calcTrim));
                        setCalcRow(null);
                      }}
                      className="h-9 px-3 rounded-md text-[12.5px] font-medium disabled:opacity-50"
                      style={{ background: "var(--pine)", color: "#f4f2ec" }}
                    >
                      Use {calcTrim == null ? "" : `${calcTrim}%`}
                    </button>
                  </div>
                  <p className="text-[10.5px] mt-2" style={{ color: "var(--muted)" }}>
                    Any weight unit works (g, oz, lb…) as long as both boxes use the same one.
                  </p>
                </div>
              )}
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

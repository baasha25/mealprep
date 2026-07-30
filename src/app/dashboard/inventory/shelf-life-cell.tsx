"use client";

import { useState, useTransition } from "react";
import { setIngredientShelfLife } from "./actions";

/** Inline editor for an ingredient's shelf life (days). Saves on blur/Enter. */
export function ShelfLifeCell({
  ingredientId,
  value,
}: {
  ingredientId: string;
  value: number | null;
}) {
  const [v, setV] = useState(value != null ? String(value) : "");
  const [pending, start] = useTransition();

  const save = () => {
    const n = Math.max(0, Math.round(Number(v) || 0));
    if (n === (value ?? 0)) return; // unchanged
    start(async () => {
      await setIngredientShelfLife({ ingredientId, days: n });
    });
  };

  return (
    <div className="flex items-center gap-1 justify-end">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        inputMode="numeric"
        placeholder="—"
        className="w-11 px-1.5 py-1 rounded-md border text-[12px] text-right outline-none"
        style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)", opacity: pending ? 0.6 : 1 }}
      />
      <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>d</span>
    </div>
  );
}

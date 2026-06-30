"use client";

import { useRef } from "react";
import { updateIngredientCost } from "./actions";

// Inline-editable ingredient cost. Saves on blur or Enter so the owner can
// tune costs right where the waste dollars update.
export function CostCell({
  ingredientId,
  costDollars,
  unit,
}: {
  ingredientId: string;
  costDollars: number;
  unit: string;
}) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form ref={ref} action={updateIngredientCost} className="flex items-center gap-1">
      <input type="hidden" name="ingredientId" value={ingredientId} />
      <span className="text-[12px]" style={{ color: "var(--muted)" }}>
        $
      </span>
      <input
        name="cost"
        type="number"
        step="0.01"
        min="0"
        defaultValue={costDollars}
        onBlur={() => ref.current?.requestSubmit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            ref.current?.requestSubmit();
          }
        }}
        className="w-16 px-2 py-1 rounded-md border text-[12.5px] outline-none"
        style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
      />
      <span className="text-[11px]" style={{ color: "var(--muted)" }}>
        /{unit}
      </span>
    </form>
  );
}

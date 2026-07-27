"use client";

import { useState, useTransition } from "react";
import { setReorderThreshold } from "./actions";

/** Inline editor for an ingredient's low-stock threshold. Saves on blur/Enter. */
export function ReorderCell({
  ingredientId,
  unit,
  value,
}: {
  ingredientId: string;
  unit: string;
  value: number;
}) {
  const [v, setV] = useState(value ? String(value) : "");
  const [pending, start] = useTransition();

  const save = () => {
    const n = Math.max(0, Number(v) || 0);
    if (n === (value || 0)) return; // unchanged
    start(async () => {
      await setReorderThreshold({ ingredientId, threshold: n });
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
        inputMode="decimal"
        placeholder="—"
        className="w-12 px-1.5 py-1 rounded-md border text-[12px] text-right outline-none"
        style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)", opacity: pending ? 0.6 : 1 }}
      />
      <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>{unit}</span>
    </div>
  );
}

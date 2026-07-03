"use client";

import { useActionState } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { Field, INP, btnPrimary } from "@/components/ui";
import { recordStockCount, type ReceiveState } from "./actions";

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export function CountForm({
  ingredients,
}: {
  ingredients: { id: string; name: string; unit: string; stockQty: number }[];
}) {
  const [state, action, pending] = useActionState<ReceiveState, FormData>(recordStockCount, { ok: false });

  return (
    <form action={action} className="grid sm:grid-cols-[1.6fr_120px_auto] gap-3 items-end">
      <Field label="Ingredient">
        <select name="ingredientId" className={INP} style={inputStyle} defaultValue={ingredients[0]?.id}>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} — system expects {Math.round(i.stockQty * 100) / 100} {i.unit}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Actual count">
        <input name="counted" type="number" step="0.01" min="0" placeholder="0" className={INP} style={inputStyle} />
      </Field>
      <div>
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={btnPrimary}>
          <ClipboardCheck size={15} /> {pending ? "Saving…" : "Record count"}
        </button>
      </div>
      {state.message && (
        <div className="sm:col-span-3 text-[12.5px] flex items-center gap-1" style={{ color: state.ok ? "#5e7350" : "var(--clay)" }}>
          {state.ok && <Check size={14} />} {state.message}
        </div>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Check, PackagePlus } from "lucide-react";
import { Field, INP, btnPrimary } from "@/components/ui";
import { receiveStock, type ReceiveState } from "./actions";

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export function ReceiveForm({ ingredients }: { ingredients: { id: string; name: string; unit: string }[] }) {
  const [state, action, pending] = useActionState<ReceiveState, FormData>(receiveStock, { ok: false });

  return (
    <form action={action} className="grid sm:grid-cols-[1.6fr_90px_110px_auto] gap-3 items-end">
      <Field label="Ingredient">
        <select name="ingredientId" className={INP} style={inputStyle} defaultValue={ingredients[0]?.id}>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
          ))}
        </select>
      </Field>
      <Field label="Qty received">
        <input name="qty" type="number" step="0.01" min="0" placeholder="40" className={INP} style={inputStyle} />
      </Field>
      <Field label="Total paid ($)">
        <input name="totalCost" type="number" step="0.01" min="0" placeholder="34.00" className={INP} style={inputStyle} />
      </Field>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={btnPrimary}>
          <PackagePlus size={15} /> {pending ? "Saving…" : "Receive"}
        </button>
      </div>
      {state.message && (
        <div className="sm:col-span-4 text-[12.5px] flex items-center gap-1" style={{ color: state.ok ? "#5e7350" : "var(--clay)" }}>
          {state.ok && <Check size={14} />} {state.message}
        </div>
      )}
    </form>
  );
}

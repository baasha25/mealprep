"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { LOSS_REASONS, LOSS_REASON_META, type LossKind, type LossReason } from "@/lib/loss";
import { logIngredientLoss, logMealLoss } from "./actions";

type ItemOpt = { id: string; name: string; unit?: string };

const INPUT =
  "w-full rounded-lg border px-3 py-2 text-[13.5px] outline-none";
const INPUT_STYLE = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export function WasteForm({ ingredients, meals }: { ingredients: ItemOpt[]; meals: ItemOpt[] }) {
  const [kind, setKind] = useState<LossKind>("ingredient");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<LossReason>("spoilage");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const options = kind === "ingredient" ? ingredients : meals;
  const selected = options.find((o) => o.id === itemId);
  const qtyLabel = kind === "ingredient" ? `Quantity${selected?.unit ? ` (${selected.unit})` : ""}` : "How many meals";

  function submit() {
    setMsg(null);
    if (!itemId) return setMsg({ ok: false, text: "Pick an item." });
    const q = Number(qty);
    if (!q || q <= 0) return setMsg({ ok: false, text: "Enter a quantity greater than 0." });
    start(async () => {
      const res =
        kind === "ingredient"
          ? await logIngredientLoss({ ingredientId: itemId, qty: q, reason, note })
          : await logMealLoss({ mealId: itemId, qty: q, reason, note });
      setMsg({ ok: res.ok, text: res.message ?? (res.ok ? "Logged." : "Something went wrong.") });
      if (res.ok) {
        setItemId("");
        setQty("");
        setNote("");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Kind toggle */}
      <div className="flex gap-2">
        {(["ingredient", "meal"] as LossKind[]).map((k) => {
          const on = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setItemId("");
              }}
              className="flex-1 rounded-lg px-3 py-2 text-[13px] font-medium border transition-colors"
              style={{
                borderColor: on ? "var(--pine)" : "var(--line)",
                background: on ? "var(--pine)" : "var(--paper)",
                color: on ? "#f4f2ec" : "var(--ink-soft)",
              }}
            >
              {k === "ingredient" ? "Raw ingredient" : "Finished meal"}
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-[11.5px] font-medium block mb-1" style={{ color: "var(--muted)" }}>
          {kind === "ingredient" ? "Ingredient" : "Meal"}
        </label>
        <select className={INPUT} style={INPUT_STYLE} value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11.5px] font-medium block mb-1" style={{ color: "var(--muted)" }}>
            {qtyLabel}
          </label>
          <input
            className={INPUT}
            style={INPUT_STYLE}
            type="number"
            min="0"
            step={kind === "ingredient" ? "0.01" : "1"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[11.5px] font-medium block mb-1" style={{ color: "var(--muted)" }}>
            Reason
          </label>
          <select className={INPUT} style={INPUT_STYLE} value={reason} onChange={(e) => setReason(e.target.value as LossReason)}>
            {LOSS_REASONS.map((r) => (
              <option key={r} value={r}>
                {LOSS_REASON_META[r].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[11.5px] font-medium block mb-1" style={{ color: "var(--muted)" }}>
          Note (optional)
        </label>
        <input
          className={INPUT}
          style={INPUT_STYLE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. driver dropped the tray"
          maxLength={300}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-medium disabled:opacity-60"
        style={{ background: "var(--clay)", color: "#f4f2ec" }}
      >
        <Trash2 size={15} /> {pending ? "Logging…" : "Log loss"}
      </button>

      {msg && (
        <p className="text-[12.5px]" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

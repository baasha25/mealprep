"use client";

import { useActionState, useState } from "react";
import { Check, Plus, Gift } from "lucide-react";
import { Field, INP, btnPrimary } from "@/components/ui";
import { createCoupon, createGiftCard, type FormState } from "./actions";

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <span className="text-[12.5px] flex items-center gap-1" style={{ color: state.ok ? "#5e7350" : "var(--clay)" }}>
      {state.ok && <Check size={14} />} {state.message}
    </span>
  );
}

export function CouponForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCoupon, { ok: false });
  const [type, setType] = useState<"percent" | "flat">("percent");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code">
          <input name="code" placeholder="FRESH10" className={INP} style={inputStyle} />
        </Field>
        <Field label={type === "percent" ? "Percent off" : "Amount off ($)"}>
          <input
            name="value"
            type="number"
            step={type === "percent" ? "1" : "0.01"}
            placeholder={type === "percent" ? "10" : "5.00"}
            className={INP}
            style={inputStyle}
          />
        </Field>
      </div>
      <div className="flex gap-1.5">
        {(["percent", "flat"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border capitalize"
            style={{
              background: type === t ? "var(--ink)" : "transparent",
              color: type === t ? "#f4f2ec" : "var(--ink-soft)",
              borderColor: type === t ? "var(--ink)" : "var(--line)",
            }}
          >
            {t === "percent" ? "% off" : "$ off"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={btnPrimary}>
          <Plus size={15} /> {pending ? "Creating…" : "Create coupon"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function GiftCardForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createGiftCard, { ok: false });

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)">
          <input name="amount" type="number" step="0.01" placeholder="50.00" className={INP} style={inputStyle} />
        </Field>
        <Field label="Recipient email (optional)">
          <input name="recipientEmail" type="email" placeholder="friend@email.com" className={INP} style={inputStyle} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={btnPrimary}>
          <Gift size={15} /> {pending ? "Issuing…" : "Issue gift card"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

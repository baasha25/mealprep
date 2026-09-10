"use client";

import { useActionState } from "react";
import { createPartner, type ActionResult } from "./actions";

export function CreatePartnerForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createPartner, null);

  return (
    <form action={action} className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <Field name="name" label="Name" placeholder="Cam Gordon" required />
      <Field name="email" label="Email" type="email" placeholder="cam@example.com" required />
      <Field name="company" label="Company (optional)" placeholder="Cam Gordon Consulting" />
      <Field name="code" label="Ref code" placeholder="cam" required hint="Becomes their link: prepflow.ca/?ref=<code>" />
      <Field name="commissionPct" label="Commission %" type="number" placeholder="20" required defaultValue="20" hint="Percent of the kitchen's monthly software fee" />

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg text-[13.5px] font-medium disabled:opacity-60"
        style={{ background: "var(--pine)", color: "#f4f2ec" }}
      >
        {pending ? "Creating…" : "Create partner"}
      </button>

      {state && (
        <p className="text-[13px]" style={{ color: state.ok ? "var(--pine)" : "var(--clay)" }}>{state.message}</p>
      )}
    </form>
  );
}

function Field({
  name, label, placeholder, type = "text", required, hint, defaultValue,
}: {
  name: string; label: string; placeholder?: string; type?: string; required?: boolean; hint?: string; defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        step={type === "number" ? "0.5" : undefined}
        className="mt-1 w-full px-3 py-2 rounded-lg border text-[13.5px] outline-none"
        style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
      />
      {hint && <span className="block text-[11.5px] mt-0.5" style={{ color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

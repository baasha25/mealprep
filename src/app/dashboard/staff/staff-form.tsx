"use client";

import { useActionState } from "react";
import { Check, UserPlus } from "lucide-react";
import { Field, INP, btnPrimary } from "@/components/ui";
import { addStaff, type StaffState } from "./actions";

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export function StaffForm() {
  const [state, action, pending] = useActionState<StaffState, FormData>(addStaff, { ok: false });
  return (
    <form action={action} className="grid sm:grid-cols-[1.8fr_120px_auto] gap-3 items-end">
      <Field label="Email">
        <input name="email" type="email" placeholder="chef@yourkitchen.com" className={INP} style={inputStyle} />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue="staff" className={INP} style={inputStyle}>
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
      </Field>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={btnPrimary}>
          <UserPlus size={15} /> {pending ? "Adding…" : "Add member"}
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

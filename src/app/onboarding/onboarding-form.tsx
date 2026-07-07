"use client";

import { useActionState } from "react";
import { Leaf } from "lucide-react";
import { createKitchen, type OnboardResult } from "./actions";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<OnboardResult | null, FormData>(
    createKitchen,
    null,
  );

  return (
    <div
      className="min-h-screen grid place-items-center px-6 py-12"
      style={{ background: "var(--paper)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-8"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="grid place-items-center w-9 h-9 rounded-md"
            style={{ background: "var(--pine)" }}
          >
            <Leaf size={18} color="#f4f2ec" />
          </div>
          <div className="disp text-[19px] font-medium" style={{ color: "var(--ink)" }}>
            Set up your kitchen
          </div>
        </div>

        <p className="text-[14px] mb-6" style={{ color: "var(--ink-soft)" }}>
          Give your meal-prep business a name and a brand color. You can change
          everything later in Settings.
        </p>

        <form action={formAction} className="space-y-5">
          <div>
            <label
              className="block text-[13px] font-medium mb-1.5"
              style={{ color: "var(--ink)" }}
            >
              Kitchen name
            </label>
            <input
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Greenleaf Kitchen"
              className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
              style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </div>

          <div>
            <label
              className="block text-[13px] font-medium mb-1.5"
              style={{ color: "var(--ink)" }}
            >
              Brand color
            </label>
            <input
              name="brandColor"
              type="color"
              defaultValue="#2f4536"
              className="h-10 w-16 rounded-lg border p-1"
              style={{ borderColor: "var(--line)", background: "var(--paper)" }}
            />
          </div>

          {state && !state.ok && (
            <div className="text-[13px]" style={{ color: "var(--clay)" }}>
              {state.message}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg px-4 py-2.5 text-[14px] font-medium disabled:opacity-60"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            {pending ? "Creating…" : "Create my kitchen"}
          </button>
        </form>
      </div>
    </div>
  );
}

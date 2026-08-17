"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Leaf, ArrowRight, ArrowLeft, Lock } from "lucide-react";
import { enterDemo, type EnterDemoState } from "./actions";

export function EnterDemoForm({ rep, repName }: { rep: string; repName: string | null }) {
  const [state, action, pending] = useActionState<EnterDemoState | null, FormData>(enterDemo, null);

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
            <Leaf size={17} color="#f4f2ec" />
          </div>
          <span className="disp text-[20px] font-medium" style={{ color: "var(--ink)" }}>
            PrepFlow
          </span>
        </div>

        <div className="rounded-2xl border p-7" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div
            className="grid place-items-center w-10 h-10 rounded-lg mb-4"
            style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)" }}
          >
            <Lock size={18} style={{ color: "var(--pine)" }} />
          </div>
          <h1 className="disp text-[24px] font-medium" style={{ color: "var(--ink)" }}>
            Open the live demo
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Enter your team&apos;s access code to open a ready-to-explore sample kitchen — real menu, orders, and live numbers you can change on the spot.
            {repName ? ` Guided by ${repName}.` : ""}
          </p>

          <form action={action} className="mt-5">
            <label className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
              Demo access code
            </label>
            <input
              name="code"
              type="password"
              autoComplete="off"
              autoFocus
              placeholder="••••••••"
              className="w-full mt-1.5 rounded-lg border px-3 py-2.5 text-[14px] outline-none"
              style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
            />
            {state && !state.ok && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--clay)" }}>
                {state.message}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-medium disabled:opacity-60"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              {pending ? "Opening your demo…" : "Enter the demo"} <ArrowRight size={16} />
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link
            href={`/demo/${rep}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: "var(--muted)" }}
          >
            <ArrowLeft size={14} /> Back to the walkthrough
          </Link>
        </div>
      </div>
    </div>
  );
}

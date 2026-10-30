"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { formatCents } from "@/lib/money";
import { chooseCateringOption } from "../../../catering-actions";

type Opt = { index: number; label: string; note: string | null; lines: { name: string; qty: number; lineCents: number }[]; totalCents: number };

/** Proposal with options: cards side by side, one "Choose" each. */
export function ChooseOption({ slug, token, options }: { slug: string; token: string; options: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((o) => (
          <div key={o.index} className="rounded-xl border p-4 flex flex-col" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Option {o.index + 1}</div>
            <div className="text-[15px] font-semibold mt-0.5" style={{ color: "var(--ink)" }}>{o.label}</div>
            <ul className="mt-2 space-y-1 text-[12.5px] flex-1" style={{ color: "var(--ink-soft)" }}>
              {o.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-2"><span>{l.name} <span style={{ color: "var(--muted)" }}>× {l.qty}</span></span><span>{formatCents(l.lineCents)}</span></li>
              ))}
            </ul>
            {o.note && <p className="text-[12px] mt-2 whitespace-pre-wrap" style={{ color: "var(--muted)" }}>{o.note}</p>}
            <div className="disp text-[20px] font-medium mt-3" style={{ color: "var(--ink)" }}>{formatCents(o.totalCents)} <span className="text-[11px] font-normal" style={{ color: "var(--muted)" }}>incl. tax</span></div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setBusy(o.index);
                start(async () => {
                  const r = await chooseCateringOption({ slug, token, index: o.index });
                  if (!r.ok) {
                    setError(r.message);
                    setBusy(null);
                    return;
                  }
                  router.refresh();
                });
              }}
              className="mt-3 w-full py-2.5 rounded-lg text-[13.5px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              {pending && busy === o.index ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Choose this
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-[12.5px] mt-3" style={{ color: "var(--clay)" }}>{error}</p>}
    </div>
  );
}

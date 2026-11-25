"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** A labelled value with a one-tap copy button (e-transfer address, amount, reference). */
export function CopyValue({ label, value, copy }: { label: string; value: string; copy?: string }) {
  const [done, setDone] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(copy ?? value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* clipboard blocked: the value is on screen to type */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="min-w-0 text-left">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
        <div className="text-[16px] font-semibold break-all" style={{ color: "var(--ink)" }}>{value}</div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[12px] font-medium"
        style={{ borderColor: "var(--line)", color: done ? "var(--pine)" : "var(--ink)", background: "var(--paper)" }}
      >
        {done ? <Check size={13} /> : <Copy size={13} />} {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

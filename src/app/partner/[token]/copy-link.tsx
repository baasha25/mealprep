"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate text-[13px] px-3 py-2 rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}>{value}</code>
      <button
        onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium shrink-0"
        style={{ background: "var(--pine)", color: "#f4f2ec" }}
      >
        {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
      </button>
    </div>
  );
}

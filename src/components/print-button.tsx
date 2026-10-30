"use client";

import { Printer } from "lucide-react";

/** "Print / save as PDF" — the browser's print dialog does the rest. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border"
      style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
    >
      <Printer size={15} /> {label}
    </button>
  );
}

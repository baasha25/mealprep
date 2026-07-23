"use client";

import { Printer } from "lucide-react";

/** Opens the browser print dialog — the user picks "Save as PDF". */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium"
      style={{ background: "var(--pine)", color: "#f4f2ec" }}
    >
      <Printer size={15} /> {label}
    </button>
  );
}

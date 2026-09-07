import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { AuditTool } from "./audit-tool";

export const metadata: Metadata = {
  title: "2-Minute Profit Leak Audit — PrepFlow",
  description:
    "Find where your meal-prep kitchen is leaking margin in about two minutes. Five quick questions, an instant Profit Leak Score, and exactly how to fix each one.",
};

export default function AuditPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--paper)" }}>
      <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
              <Leaf size={17} color="#f4f2ec" />
            </div>
            <span className="disp text-[19px] font-medium" style={{ color: "var(--ink)" }}>PrepFlow</span>
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 rounded-lg text-[13px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            Start free
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 sm:py-14">
        <div className="text-center max-w-xl mx-auto mb-9">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] mb-3" style={{ color: "var(--muted)" }}>
            Free · ~2 minutes · no sign-up
          </div>
          <h1 className="disp text-[34px] sm:text-[40px] leading-[1.05] font-medium mb-3" style={{ color: "var(--ink)" }}>
            The Profit Leak Audit
          </h1>
          <p className="text-[15px]" style={{ color: "var(--ink-soft)" }}>
            Five quick questions to find where your meal-prep kitchen is quietly losing margin — and exactly how to close each gap.
          </p>
        </div>
        <AuditTool />
      </main>

      <footer className="border-t" style={{ borderColor: "var(--line)" }}>
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-[12px]" style={{ color: "var(--muted)" }}>
          Built for the line. Engineered for margins. · <Link href="/" style={{ color: "var(--pine)" }}>prepflow.ca</Link>
        </div>
      </footer>
    </div>
  );
}

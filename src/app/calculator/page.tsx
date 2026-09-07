import type { Metadata } from "next";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { CalculatorTool } from "./calculator-tool";

export const metadata: Metadata = {
  title: "Recipe Profit Calculator — PrepFlow",
  description:
    "See the real margin on a meal in seconds. Enter your price, protein, trim %, and ingredient cost — get plate cost, margin, and the dollars lost to trim.",
};

export default function CalculatorPage() {
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
            Free · instant · no sign-up
          </div>
          <h1 className="disp text-[34px] sm:text-[40px] leading-[1.05] font-medium mb-3" style={{ color: "var(--ink)" }}>
            Recipe Profit Calculator
          </h1>
          <p className="text-[15px]" style={{ color: "var(--ink-soft)" }}>
            The real margin on a meal isn&apos;t on your invoice. Enter a dish below and see your plate cost, margin, and the dollars you buy just to trim away.
          </p>
        </div>
        <CalculatorTool />
      </main>

      <footer className="border-t" style={{ borderColor: "var(--line)" }}>
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-[12px]" style={{ color: "var(--muted)" }}>
          Built for the line. Engineered for margins. · <Link href="/" style={{ color: "var(--pine)" }}>prepflow.ca</Link>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Leaf } from "lucide-react";

/** Contact address used across the legal pages — change in ONE place. */
export const LEGAL_CONTACT = "support@prepflow.ca";

/** Shared, brand-styled shell for the Terms / Privacy pages. */
export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <header className="border-b" style={{ borderColor: "var(--line)" }}>
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
              <Leaf size={17} color="#f4f2ec" />
            </div>
            <span className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>PrepFlow</span>
          </Link>
          <div className="flex items-center gap-5 text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="disp text-[32px] font-medium mb-1" style={{ color: "var(--ink)" }}>{title}</h1>
        <p className="text-[13px] mb-8" style={{ color: "var(--muted)" }}>Last updated {updated}</p>
        <div className="legal-prose space-y-6">{children}</div>
        <div className="mt-12 pt-6 text-[13px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
          Questions? Email <a href={`mailto:${LEGAL_CONTACT}`} style={{ color: "var(--pine)" }}>{LEGAL_CONTACT}</a>.
        </div>
      </main>
    </div>
  );
}

/** A titled section of legal prose. */
export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-semibold mb-2" style={{ color: "var(--ink)" }}>{heading}</h2>
      <div className="space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{children}</div>
    </section>
  );
}

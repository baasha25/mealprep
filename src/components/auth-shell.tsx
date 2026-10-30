import Link from "next/link";
import { Leaf } from "lucide-react";

/**
 * Branded frame around Clerk's sign-in / sign-up cards: PrepFlow logo that
 * leads back to the landing page, a line of what this is, and the legal links.
 * Clerk draws the form itself; `clerkAppearance` tunes it to our tokens.
 */
export function AuthShell({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--paper)" }}>
      <header className="px-6 pt-6">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="PrepFlow home">
          <span className="grid place-items-center w-9 h-9 rounded-lg" style={{ background: "var(--pine)" }}>
            <Leaf size={18} color="#f4f2ec" />
          </span>
          <span className="disp text-[22px] font-medium" style={{ color: "var(--pine)" }}>PrepFlow</span>
        </Link>
      </header>

      <main className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-5">
            <h1 className="disp text-[28px] leading-tight font-medium" style={{ color: "var(--ink)" }}>{title}</h1>
            <p className="text-[14px] mt-1.5" style={{ color: "var(--ink-soft)" }}>{blurb}</p>
          </div>
          <div className="flex justify-center">{children}</div>
        </div>
      </main>

      <footer className="px-6 pb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px]" style={{ color: "var(--muted)" }}>
        <Link href="/" className="hover:underline">prepflow.ca</Link>
        <Link href="/terms" className="hover:underline">Terms</Link>
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <span>Built in Canada for independent kitchens</span>
      </footer>
    </div>
  );
}

/** Stand-in for the Clerk card when auth runs in local dev-stub mode. */
export function AuthStubCard() {
  return (
    <div className="w-full max-w-[400px] rounded-xl border p-6 text-center" style={{ background: "#fffdf8", borderColor: "var(--line)", boxShadow: "0 1px 2px rgba(31,30,26,.04), 0 12px 32px -16px rgba(31,30,26,.25)" }}>
      <p className="text-[13.5px]" style={{ color: "var(--ink)" }}>Auth is in dev-stub mode: no sign-in needed here.</p>
      <Link href="/dashboard" className="inline-block mt-4 px-4 py-2.5 rounded-lg text-[13.5px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>Open the dashboard</Link>
      <p className="text-[11.5px] mt-3" style={{ color: "var(--muted)" }}>In production this is Clerk&apos;s sign-in card, styled to match.</p>
    </div>
  );
}

/** Clerk `appearance` that matches the storefront and dashboard tokens. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#2f4536",
    colorText: "#1f1e1a",
    colorTextSecondary: "#8a857a",
    colorBackground: "#fffdf8",
    colorInputBackground: "#f4f2ec",
    colorInputText: "#1f1e1a",
    colorDanger: "#a85a3f",
    borderRadius: "10px",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    card: { boxShadow: "0 1px 2px rgba(31,30,26,.04), 0 12px 32px -16px rgba(31,30,26,.25)", border: "1px solid #e7e3d8" },
    headerTitle: { display: "none" },
    headerSubtitle: { display: "none" },
    formButtonPrimary: { background: "#2f4536", boxShadow: "none", textTransform: "none", fontSize: "14px" },
    footerActionLink: { color: "#2f4536", fontWeight: 600 },
    socialButtonsBlockButton: { border: "1px solid #e7e3d8", background: "#fff" },
  },
} as const;

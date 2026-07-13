"use client";

import { useState } from "react";
import Link from "next/link";
import { Leaf, Menu, X } from "lucide-react";

const LINKS = [
  ["#features", "Features"],
  ["#how", "How it works"],
  ["#pricing", "Pricing"],
  ["#faq", "FAQ"],
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--paper) 88%, transparent)" }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
            <Leaf size={17} color="#f4f2ec" />
          </div>
          <span className="disp text-[19px] font-medium" style={{ color: "var(--ink)" }}>PrepFlow</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="text-[13.5px] font-medium transition-colors" style={{ color: "var(--ink-soft)" }}>
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2.5">
          <Link href="/sign-in" className="text-[13.5px] font-medium px-3.5 py-2 rounded-lg" style={{ color: "var(--ink)" }}>
            Sign in
          </Link>
          <Link href="/sign-up" className="text-[13.5px] font-medium px-4 py-2 rounded-lg" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
            Start free
          </Link>
        </div>

        <button className="md:hidden grid place-items-center w-9 h-9 rounded-md" onClick={() => setOpen((v) => !v)} aria-label="Menu" style={{ border: "1px solid var(--line)" }}>
          {open ? <X size={18} style={{ color: "var(--ink)" }} /> : <Menu size={18} style={{ color: "var(--ink)" }} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t px-6 py-4 space-y-3" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block text-[14px] font-medium" style={{ color: "var(--ink-soft)" }}>
              {label}
            </a>
          ))}
          <div className="flex gap-2.5 pt-2">
            <Link href="/sign-in" className="flex-1 text-center text-[13.5px] font-medium px-3.5 py-2 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Sign in</Link>
            <Link href="/sign-up" className="flex-1 text-center text-[13.5px] font-medium px-4 py-2 rounded-lg" style={{ background: "var(--pine)", color: "#f4f2ec" }}>Start free</Link>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";

export function DemoLinkBuilder({ origin }: { origin: string }) {
  const [rep, setRep] = useState("terry");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("#2f4536");
  const [logo, setLogo] = useState("");
  const [keep, setKeep] = useState(7);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const slug = rep.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "demo";
    const q = new URLSearchParams();
    if (brand.trim()) q.set("brand", brand.trim());
    if (/^#[0-9a-fA-F]{6}$/.test(color) && color.toLowerCase() !== "#2f4536") q.set("color", color);
    if (/^https:\/\//.test(logo.trim())) q.set("logo", logo.trim());
    if (brand.trim() && keep > 0) q.set("keep", String(keep));
    const qs = q.toString();
    return `${origin}/demo/${slug}/enter${qs ? `?${qs}` : ""}`;
  }, [origin, rep, brand, color, logo, keep]);

  const inp = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 items-start">
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <L label="Rep (attribution)" hint="Who gets credit — becomes the /demo/<rep> part.">
          <input value={rep} onChange={(e) => setRep(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-[13.5px]" style={inp} />
        </L>
        <L label="Prospect's kitchen name" hint="Shows as the kitchen name and in the greeting.">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="MealFix Canada" className="w-full px-3 py-2 rounded-lg border text-[13.5px]" style={inp} />
        </L>
        <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
          <L label="Brand colour">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded-lg border" style={inp} />
          </L>
          <L label="Logo URL (https, optional)" hint="A square PNG works best.">
            <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" className="w-full px-3 py-2 rounded-lg border text-[13.5px]" style={inp} />
          </L>
        </div>
        <L label={`Keep the demo alive for ${keep} day${keep === 1 ? "" : "s"}`} hint="Re-opening the same link returns the same kitchen. 0 = fresh throwaway each time (24h).">
          <input type="range" min={0} max={14} value={keep} onChange={(e) => setKeep(Number(e.target.value))} className="w-full" />
        </L>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="text-[11.5px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Your demo link</div>
        <div className="flex items-start gap-2">
          <code className="flex-1 min-w-0 break-all text-[12.5px] px-3 py-2 rounded-lg border leading-relaxed" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}>{url}</code>
          <button
            onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium shrink-0"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
        <div className="mt-4 rounded-lg p-3 text-[12.5px] space-y-1.5" style={{ background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
          <div><strong style={{ color: "var(--ink)" }}>Preview:</strong> kitchen named <strong style={{ color: "var(--ink)" }}>{brand.trim() || "Demo Kitchen"}</strong>, colour <span className="inline-block w-3 h-3 rounded-sm align-middle" style={{ background: color }} /> {color}{logo ? ", with logo" : ""}.</div>
          <div>{brand.trim() && keep > 0 ? `Reusable for ${keep} day${keep === 1 ? "" : "s"} — set up their menu/brand once, it's there on the next visit.` : "Fresh throwaway sandbox each time (swept after 24h)."}</div>
          <div>The prospect still enters the team access code. Storefront lives at the demo kitchen&apos;s own /store URL while it&apos;s alive.</div>
        </div>
      </div>
    </div>
  );
}

function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-[11.5px] mt-0.5" style={{ color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

export type ShareLink = {
  key: string;
  label: string;
  description: string;
  url: string;
  buttonText: string;
};

const card = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(31,30,26,.03)",
} as const;

function buttonSnippet(url: string, text: string, color: string): string {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:11px 20px;border-radius:8px;font-family:sans-serif;font-size:15px;font-weight:600;text-decoration:none;">${text}</a>`;
}

// A button that opens the storefront in a centered pop-up window (like the
// delivery apps), so customers order without fully leaving the merchant's site.
// Falls back to a normal new-tab open if the browser blocks the pop-up.
function popupSnippet(url: string, text: string, color: string): string {
  return `<a href="${url}" target="prepflow" onclick="window.open(this.href,'prepflow','width=460,height=780,menubar=no,toolbar=no');return false;" style="display:inline-block;background:${color};color:#ffffff;padding:11px 20px;border-radius:8px;font-family:sans-serif;font-size:15px;font-weight:600;text-decoration:none;">${text}</a>`;
}

export function ShareLinks({ links, brandColor }: { links: ShareLink[]; brandColor: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const CopyBtn = ({ id, text }: { id: string; text: string }) => (
    <button
      onClick={() => copy(id, text)}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium shrink-0"
      style={{ background: "var(--pine)", color: "#f4f2ec" }}
    >
      {copied === id ? <Check size={14} /> : <Copy size={14} />}
      {copied === id ? "Copied" : "Copy"}
    </button>
  );

  return (
    <div className="space-y-4">
      <p className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
        Paste these onto your own website, Instagram bio, or Linktree. Customers click through to
        your branded PrepFlow page — no website-building required.
      </p>

      {links.map((l) => (
        <div key={l.key} className="rounded-xl border p-5" style={card}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{l.label}</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>{l.description}</div>
            </div>
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[12.5px] font-medium shrink-0"
              style={{ color: "var(--pine)" }}
            >
              Preview <ExternalLink size={13} />
            </a>
          </div>

          {/* Raw link */}
          <div className="mb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
              Link
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={l.url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-[13px] font-mono outline-none"
                style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
              />
              <CopyBtn id={`${l.key}-url`} text={l.url} />
            </div>
          </div>

          {/* Button HTML snippet */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
              Paste-ready button (HTML)
            </div>
            <div className="flex items-start gap-2">
              <pre
                className="flex-1 min-w-0 overflow-x-auto rounded-lg border px-3 py-2 text-[11.5px] font-mono"
                style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink-soft)" }}
              >
                {buttonSnippet(l.url, l.buttonText, brandColor)}
              </pre>
              <CopyBtn id={`${l.key}-html`} text={buttonSnippet(l.url, l.buttonText, brandColor)} />
            </div>
          </div>

          {/* Pop-up button snippet — opens ordering in a window, no navigating away */}
          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
              Pop-up button (opens in a window)
            </div>
            <div className="flex items-start gap-2">
              <pre
                className="flex-1 min-w-0 overflow-x-auto rounded-lg border px-3 py-2 text-[11.5px] font-mono"
                style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink-soft)" }}
              >
                {popupSnippet(l.url, l.buttonText, brandColor)}
              </pre>
              <CopyBtn id={`${l.key}-popup`} text={popupSnippet(l.url, l.buttonText, brandColor)} />
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
              Opens your ordering page in a pop-up window so customers don&apos;t leave your site. If a browser
              blocks the pop-up, it opens in a new tab instead.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

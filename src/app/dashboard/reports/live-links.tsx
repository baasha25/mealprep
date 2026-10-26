"use client";

import { useState, useTransition } from "react";
import { Link2, RefreshCw, Copy, Check, Power } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { importDataFormula } from "@/lib/export-key";
import { rotateExportKey, clearExportKey } from "./actions";

const REPORTS = [
  { path: "orders", label: "Orders ledger" },
  { path: "production", label: "Production pull-list (by day & station)" },
  { path: "shopping-list", label: "Shopping list" },
  { path: "meals", label: "Menu & margins" },
  { path: "customers", label: "Customers" },
  { path: "subscriptions", label: "Subscriptions" },
  { path: "inventory", label: "Inventory" },
];

/** Live, read-only CSV links a kitchen pastes into Google Sheets with IMPORTDATA. */
export function LiveLinks({ origin, exportKey }: { origin: string; exportKey: string | null }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (v: string) => {
    try { void navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied(null), 1500); } catch { /* blocked */ }
  };
  return (
    <Card className="mt-4 no-print">
      <CardTitle icon={<Link2 size={15} />} title="Live links for Google Sheets" note={exportKey ? "On" : "Off"} />
      <p className="text-[12.5px] mb-3 -mt-2" style={{ color: "var(--muted)" }}>
        Paste a formula into any cell of a Google Sheet and the report fills in and keeps itself up to date (Sheets refreshes about hourly). The links are read-only and private to your kitchen; regenerate them and the old ones stop working.
      </p>
      {note && <p className="text-[12.5px] mb-3 px-3 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--pine) 9%, transparent)", color: "var(--pine)" }}>{note}</p>}
      {!exportKey ? (
        <button type="button" disabled={pending} onClick={() => start(async () => setNote((await rotateExportKey()).message))} className="px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
          {pending ? "Creating…" : "Create live links"}
        </button>
      ) : (
        <>
          <div className="space-y-1.5">
            {REPORTS.map((r) => {
              const url = `${origin}/dashboard/reports/${r.path}?key=${exportKey}`;
              const f = importDataFormula(url);
              return (
                <div key={r.path} className="flex items-center gap-2 text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <span className="w-56 shrink-0" style={{ color: "var(--ink)" }}>{r.label}</span>
                  <code className="flex-1 truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{f}</code>
                  <button type="button" onClick={() => copy(f)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[12px]" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                    {copied === f ? <Check size={12} /> : <Copy size={12} />} {copied === f ? "Copied" : "Copy formula"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button type="button" disabled={pending} onClick={() => { if (confirm("Regenerate? Every sheet using the old links will stop updating until you paste the new ones.")) start(async () => setNote((await rotateExportKey()).message)); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12.5px] font-medium disabled:opacity-50" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              <RefreshCw size={13} /> Regenerate links
            </button>
            <button type="button" disabled={pending} onClick={() => { if (confirm("Switch live links off? Sheets using them will stop updating.")) start(async () => setNote((await clearExportKey()).message)); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium disabled:opacity-50" style={{ color: "var(--clay)" }}>
              <Power size={13} /> Switch off
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

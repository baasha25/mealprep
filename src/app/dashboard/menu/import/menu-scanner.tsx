"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ImagePlus, Loader2, Check, Trash2, ScanLine, Sparkles } from "lucide-react";
import { formatCents } from "@/lib/money";
import { scanMenu, applyMenu } from "./actions";

type Row = {
  name: string;
  description: string | null;
  priceCents: number | null;
  diet: string | null;
  include: boolean;
};

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;
const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;

export function MenuScanner({ enabled }: { enabled: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number } | null>(null);
  const [applying, startApply] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okType = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) {
      setError("Please choose a photo (JPG/PNG/WebP) or a PDF of your menu.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That file is over 8 MB. Try a smaller photo.");
      return;
    }
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      const result = await scanMenu(base64, file.type);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRows(
        result.meals.map((m) => ({
          name: m.name,
          description: m.description,
          priceCents: m.priceCents,
          diet: m.diet,
          include: true,
        })),
      );
    } catch {
      setError("Something went wrong reading that file. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const upd = (i: number, patch: Partial<Row>) =>
    setRows((cur) => (cur ? cur.map((r, x) => (x === i ? { ...r, ...patch } : r)) : cur));

  const included = rows?.filter((r) => r.include && r.name.trim()) ?? [];

  const apply = () =>
    startApply(async () => {
      const r = await applyMenu({
        meals: included.map((m) => ({
          name: m.name,
          description: m.description,
          priceCents: m.priceCents ?? 0,
          diet: m.diet,
        })),
      });
      if (r.ok) {
        setDone({ created: r.created ?? included.length });
        setRows(null);
      } else {
        setError(r.message);
      }
    });

  if (!enabled) {
    return (
      <div className="rounded-xl border p-8 text-center" style={card}>
        <ScanLine size={22} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
        <p className="text-[14px]" style={{ color: "var(--ink)" }}>Menu import isn&apos;t switched on yet.</p>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
          It needs an AI key configured by the platform. In the meantime, add meals manually or via CSV import.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border p-8 text-center" style={card}>
        <div className="grid place-items-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}>
          <Check size={24} style={{ color: "var(--pine)" }} />
        </div>
        <p className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Added {done.created} meals to your menu</p>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>Add photos, recipes and macros to each from the menu.</p>
        <Link href="/dashboard/menu" className="inline-block mt-4 px-4 py-2 rounded-lg text-[13px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
          Go to menu
        </Link>
      </div>
    );
  }

  return (
    <div>
      {!rows && (
        <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <Sparkles size={22} className="mx-auto mb-3" style={{ color: "var(--pine)" }} />
          <p className="text-[14.5px] font-medium" style={{ color: "var(--ink)" }}>Upload a photo or PDF of your menu</p>
          <p className="text-[12.5px] mt-1 mb-4 max-w-md mx-auto" style={{ color: "var(--muted)" }}>
            We&apos;ll read the dishes, prices and descriptions and turn them into menu items — you review before anything is added.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13.5px] font-medium disabled:opacity-60"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {busy ? "Reading your menu…" : "Choose menu photo / PDF"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onPick} className="hidden" />
        </div>
      )}

      {error && (
        <p className="text-[12.5px] mt-3" style={{ color: "var(--clay)" }}>{error}</p>
      )}

      {rows && (
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <p className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
              Found <strong>{rows.length}</strong> meals. Review, edit prices, untick any you don&apos;t want, then add.
            </p>
            <button onClick={() => { setRows(null); setError(null); }} className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              Start over
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                style={{ ...card, opacity: r.include ? 1 : 0.5 }}
              >
                <input type="checkbox" checked={r.include} onChange={(e) => upd(i, { include: e.target.checked })} />
                <div className="flex-1 min-w-0">
                  <input
                    value={r.name}
                    onChange={(e) => upd(i, { name: e.target.value })}
                    className="w-full rounded-md border px-2.5 py-1.5 text-[13.5px] font-medium outline-none"
                    style={inputStyle}
                  />
                  {r.description && (
                    <div className="text-[11.5px] mt-1 truncate" style={{ color: "var(--muted)" }}>
                      {r.description}{r.diet ? ` · ${r.diet}` : ""}
                    </div>
                  )}
                </div>
                <div className="relative w-24 shrink-0">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: "var(--muted)" }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={r.priceCents == null ? "" : (r.priceCents / 100).toFixed(2)}
                    onChange={(e) => upd(i, { priceCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })}
                    placeholder="0.00"
                    className="w-full rounded-md border pl-5 pr-2 py-1.5 text-[13px] outline-none text-right"
                    style={inputStyle}
                  />
                </div>
                <button onClick={() => setRows((cur) => cur!.filter((_, x) => x !== i))} aria-label="Remove" className="shrink-0">
                  <Trash2 size={15} style={{ color: "var(--clay)" }} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={apply}
              disabled={applying || included.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium disabled:opacity-50"
              style={{ background: "var(--pine)", color: "#f4f2ec" }}
            >
              <Check size={16} /> {applying ? "Adding…" : `Add ${included.length} meal${included.length === 1 ? "" : "s"} to menu`}
            </button>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>You can add photos, recipes &amp; macros after.</span>
          </div>
        </div>
      )}
    </div>
  );
}

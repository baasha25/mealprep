"use client";

import { useState } from "react";
import { Printer, Tag, ClipboardList, AlertTriangle, Check, Download } from "lucide-react";
import { batchZpl, type ZplLabel, type ZplSize } from "@/lib/zpl";

export type PackingSlip = {
  id: string;
  code: string;
  customerName: string;
  address: string | null;
  zone: string | null;
  fulfillment: string;
  customerAllergens: string[];
  items: { name: string; qty: number }[];
};

export type MealLabel = {
  name: string;
  qty: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  swatch: string;
  bestByLabel: string; // per-meal "best by" from its shelf life
};

export function Fulfillment({
  businessName,
  slips,
  labels,
}: {
  businessName: string;
  slips: PackingSlip[];
  labels: MealLabel[];
}) {
  const [tab, setTab] = useState<"packing" | "labels">("packing");
  const [size, setSize] = useState<"small" | "medium" | "large">("small");
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  // Per-meal print quantity, overriding the production count (blank = use it).
  const [qtyOverride, setQtyOverride] = useState<Record<string, number>>({});
  const [zplSize, setZplSize] = useState<ZplSize>("4x2");

  const qtyOf = (l: MealLabel) => {
    const o = qtyOverride[l.name];
    return o == null ? l.qty : o;
  };
  const shownLabels = labels.filter((l) => !excluded[l.name]);
  const totalLabels = shownLabels.reduce((s, l) => s + qtyOf(l), 0);
  const gridCols =
    size === "large" ? "grid-cols-1" : size === "medium" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  const toggleMeal = (name: string) => setExcluded((e) => ({ ...e, [name]: !e[name] }));
  const setQty = (name: string, v: string) =>
    setQtyOverride((q) => {
      const n = Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
      return { ...q, [name]: n };
    });

  // Build ZPL for every selected meal at its (possibly overridden) quantity and
  // download it as a .zpl file the kitchen sends straight to a Zebra printer.
  const downloadZpl = () => {
    const zplLabels: ZplLabel[] = shownLabels.map((l) => ({
      businessName,
      name: l.name,
      calories: l.calories,
      proteinG: l.proteinG,
      carbsG: l.carbsG,
      fatG: l.fatG,
      allergens: l.allergens,
      bestByLabel: l.bestByLabel,
      qty: qtyOf(l),
    }));
    const zpl = batchZpl(zplLabels, zplSize);
    const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `labels-${stamp}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (slips.length === 0 && labels.length === 0) {
    return (
      <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <ClipboardList size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
        <p className="text-[14px]" style={{ color: "var(--ink)" }}>Nothing in the production queue.</p>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>Mark orders paid or in production to print labels and slips.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls (hidden when printing) */}
      <div className="no-print flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="inline-flex p-0.5 rounded-lg" style={{ background: "var(--sand)", border: "1px solid var(--line)" }}>
          {([["packing", "Packing slips", ClipboardList], ["labels", "Meal labels", Tag]] as const).map(([id, label, Icon]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[13px] font-medium transition-colors"
                style={{ background: on ? "var(--surface)" : "transparent", color: on ? "var(--ink)" : "var(--muted)", boxShadow: on ? "0 1px 2px rgba(31,30,26,.06)" : "none" }}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium"
          style={{ background: "var(--pine)", color: "#f4f2ec" }}
        >
          <Printer size={15} /> Print {tab === "packing" ? `${slips.length} slips` : `${totalLabels} labels`}
        </button>
      </div>

      {tab === "packing" ? (
        <div className="space-y-4 print-full">
          {slips.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--line)", background: "var(--surface)", breakInside: "avoid", pageBreakAfter: "always" }}
            >
              <div className="flex items-start justify-between gap-4 pb-3 mb-3" style={{ borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div className="disp text-[16px] font-medium" style={{ color: "var(--ink)" }}>{businessName}</div>
                  <div className="text-[12px]" style={{ color: "var(--muted)" }}>Packing slip · Order #{s.code}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{s.customerName}</div>
                  <div className="text-[12px] capitalize" style={{ color: "var(--muted)" }}>{s.fulfillment}{s.zone ? ` · ${s.zone}` : ""}</div>
                </div>
              </div>
              {s.address && (
                <div className="text-[12.5px] mb-3" style={{ color: "var(--ink-soft)" }}>{s.address}</div>
              )}
              {s.customerAllergens.length > 0 && (
                <div className="flex items-center gap-1.5 text-[12px] mb-3 px-3 py-1.5 rounded-md" style={{ background: "color-mix(in srgb, var(--clay) 9%, transparent)", color: "var(--clay)" }}>
                  <AlertTriangle size={13} /> Customer allergens: {s.customerAllergens.join(", ")}
                </div>
              )}
              <div className="space-y-1.5">
                {s.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-[13.5px]">
                    <span style={{ color: "var(--ink)" }}>{it.name}</span>
                    <span className="font-semibold" style={{ color: "var(--ink)" }}>×{it.qty}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 flex justify-between text-[12px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
                <span>{s.items.reduce((a, b) => a + b.qty, 0)} meals</span>
                <span>Packed by __________</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Label controls (hidden when printing) */}
          <div className="no-print mb-4 space-y-3">
            <div>
              <div className="text-[12px] mb-1.5" style={{ color: "var(--muted)" }}>
                Which meals to print — set a quantity to print any batch size
              </div>
              <div className="flex flex-wrap gap-2">
                {labels.map((l) => {
                  const on = !excluded[l.name];
                  return (
                    <div
                      key={l.name}
                      className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-lg border"
                      style={{
                        borderColor: on ? "var(--pine)" : "var(--line)",
                        background: on ? "color-mix(in srgb, var(--pine) 8%, transparent)" : "var(--surface)",
                      }}
                    >
                      <button
                        onClick={() => toggleMeal(l.name)}
                        className="flex items-center gap-1.5 text-[12.5px]"
                        style={{ color: on ? "var(--pine)" : "var(--muted)" }}
                      >
                        {on ? <Check size={13} /> : <span style={{ width: 13 }} />} {l.name}
                      </button>
                      {on && (
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          value={qtyOf(l)}
                          onChange={(e) => setQty(l.name, e.target.value)}
                          title="How many of this label to print"
                          className="w-16 text-[12px] rounded-md border px-1.5 py-1 outline-none text-center"
                          style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>Sheet size (paper)</span>
              <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)" }}>
                {([["small", "3-up"], ["medium", "2-up"], ["large", "1-up"]] as const).map(([k, lab]) => (
                  <button
                    key={k}
                    onClick={() => setSize(k)}
                    className="px-2.5 py-1 rounded-md text-[12px] font-medium"
                    style={{ background: size === k ? "var(--pine)" : "transparent", color: size === k ? "#f4f2ec" : "var(--muted)" }}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>

            {/* Zebra / thermal printers — export ZPL to send straight to the printer. */}
            <div
              className="flex items-center gap-2 flex-wrap pt-3"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>Zebra label</span>
              <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)" }}>
                {([["4x2", '4" × 2"'], ["2x1", '2" × 1"']] as const).map(([k, lab]) => (
                  <button
                    key={k}
                    onClick={() => setZplSize(k)}
                    className="px-2.5 py-1 rounded-md text-[12px] font-medium"
                    style={{ background: zplSize === k ? "var(--pine)" : "transparent", color: zplSize === k ? "#f4f2ec" : "var(--muted)" }}
                  >
                    {lab}
                  </button>
                ))}
              </div>
              <button
                onClick={downloadZpl}
                disabled={shownLabels.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border disabled:opacity-50"
                style={{ borderColor: "var(--pine)", color: "var(--pine)" }}
              >
                <Download size={14} /> Download .zpl ({totalLabels})
              </button>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                Send the file to your Zebra — via Zebra Browser Print, Zebra Setup Utilities, or your print queue.
              </span>
            </div>
          </div>

          {shownLabels.length === 0 ? (
            <p className="text-[13px] no-print" style={{ color: "var(--muted)" }}>Select at least one meal to print labels.</p>
          ) : (
            <>
            {(() => {
              // Cap how many label divs we render so a big batch (e.g. 5,000)
              // doesn't lock the browser — paper printing is for smaller runs;
              // large batches go to Zebra via the .zpl export above.
              const CAP = 300;
              const rendered: { l: MealLabel; i: number }[] = [];
              for (const l of shownLabels) {
                const n = qtyOf(l);
                for (let i = 0; i < n && rendered.length < CAP; i++) rendered.push({ l, i });
              }
              const truncated = totalLabels > rendered.length;
              return (
            <>
            {truncated && (
              <p className="text-[12px] no-print mb-2 px-3 py-2 rounded-md" style={{ background: "var(--sand)", color: "var(--muted)" }}>
                Showing the first {rendered.length} of {totalLabels} labels on screen. For the full run, use <strong>Download .zpl</strong> (Zebra) — it prints all {totalLabels}.
              </p>
            )}
            <div className={`grid ${gridCols} gap-3 print-full`}>
              {rendered.map(({ l, i }) => (
                  <div
                    key={`${l.name}-${i}`}
                    className="rounded-lg border p-3"
                    style={{ borderColor: "var(--line)", background: "var(--surface)", breakInside: "avoid" }}
                  >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.swatch }} />
                  <span className="text-[13px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{l.name}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-2 text-center">
                  {([["Cal", l.calories], ["P", `${l.proteinG}g`], ["C", `${l.carbsG}g`], ["F", `${l.fatG}g`]] as const).map(([k, v]) => (
                    <div key={k} className="rounded py-1" style={{ background: "var(--paper)" }}>
                      <div className="text-[9px]" style={{ color: "var(--muted)" }}>{k}</div>
                      <div className="text-[11.5px] font-semibold" style={{ color: "var(--ink)" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span style={{ color: "var(--muted)" }}>Best by {l.bestByLabel}</span>
                  {l.allergens.length > 0 && (
                    <span className="capitalize" style={{ color: "var(--clay)" }}>{l.allergens.join(", ")}</span>
                  )}
                </div>
                  </div>
              ))}
            </div>
            </>
              );
            })()}
            </>
          )}
        </>
      )}
    </div>
  );
}

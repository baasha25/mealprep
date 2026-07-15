"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Check, X, Sparkles } from "lucide-react";
import { INP, btnPrimary } from "@/components/ui";
import { scanInvoice, applyInvoice } from "./invoice-actions";

type Ingredient = { id: string; name: string; unit: string };
type Row = {
  include: boolean;
  name: string;
  qty: string;
  unit: string;
  cost: string; // dollars
  ingredientId: string; // "" = create new
};

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

// Downscale images client-side (keeps the upload small + cheaper to read); PDFs pass through.
async function fileToPayload(file: File): Promise<{ base64: string; mediaType: string }> {
  if (file.type === "application/pdf") {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { base64: btoa(bin), mediaType: "application/pdf" };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}

export function InvoiceScanner() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [vendor, setVendor] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);

  const onPick = async (file: File) => {
    setError(null);
    setDone(null);
    setRows(null);
    setScanning(true);
    try {
      const { base64, mediaType } = await fileToPayload(file);
      const res = await scanInvoice(base64, mediaType);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setVendor(res.vendor);
      setIngredients(res.ingredients);
      setRows(
        res.lines.map((l) => ({
          include: true,
          name: l.name,
          qty: String(l.qty),
          unit: l.unit,
          cost: (l.totalCostCents / 100).toFixed(2),
          ingredientId: l.matchIngredientId ?? "",
        })),
      );
    } catch {
      setError("Couldn't process that file. Try a JPG, PNG, or PDF.");
    } finally {
      setScanning(false);
    }
  };

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => (rs ? rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)) : rs));

  const save = () => {
    if (!rows) return;
    const items = rows
      .filter((r) => r.include && r.name.trim() && Number(r.qty) > 0)
      .map((r) => ({
        name: r.name.trim(),
        qty: Number(r.qty),
        unit: r.unit.trim() || "ea",
        totalCostCents: Math.round(Number(r.cost || "0") * 100),
        ingredientId: r.ingredientId || null,
      }));
    if (items.length === 0) {
      setError("Select at least one line to add.");
      return;
    }
    start(async () => {
      setError(null);
      const res = await applyInvoice({ items });
      if (res.ok) {
        setDone(res.message);
        setRows(null);
        setVendor(null);
      } else {
        setError(res.message);
      }
    });
  };

  const includedCount = rows?.filter((r) => r.include).length ?? 0;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />

      {!rows && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 disabled:opacity-60"
          style={{ borderColor: "var(--line)", background: "var(--paper)" }}
        >
          {scanning ? (
            <span className="flex items-center gap-2 text-[13.5px] font-medium" style={{ color: "var(--pine)" }}>
              <Sparkles size={16} className="animate-pulse" /> Reading your invoice…
            </span>
          ) : (
            <>
              <Upload size={22} style={{ color: "var(--pine)" }} />
              <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                Upload a photo or PDF of an invoice
              </span>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                We&apos;ll read the line items so you don&apos;t have to type them
              </span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="mt-3 text-[13px] flex items-center gap-1.5" style={{ color: "var(--clay)" }}>
          <X size={14} /> {error}
        </p>
      )}
      {done && (
        <p className="mt-3 text-[13px] flex items-center gap-1.5" style={{ color: "#5e7350" }}>
          <Check size={14} /> {done}
        </p>
      )}

      {rows && (
        <div className="mt-1">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              {vendor ? <>From <span style={{ color: "var(--ink)" }}>{vendor}</span> · </> : null}
              Found {rows.length} line{rows.length === 1 ? "" : "s"} — review, then add to stock.
            </div>
            <button type="button" onClick={() => setRows(null)} className="text-[12.5px]" style={{ color: "var(--muted)" }}>
              Cancel
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1.6fr_0.7fr_0.7fr_0.8fr_1.4fr] items-center gap-2 px-2 py-2 rounded-lg"
                style={{ background: "var(--paper)", border: "1px solid var(--line)", opacity: r.include ? 1 : 0.5 }}
              >
                <input type="checkbox" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} />
                <input value={r.name} onChange={(e) => patch(i, { name: e.target.value })} className={INP} style={inputStyle} placeholder="Ingredient" />
                <input value={r.qty} onChange={(e) => patch(i, { qty: e.target.value })} className={INP} style={inputStyle} placeholder="Qty" inputMode="decimal" />
                <input value={r.unit} onChange={(e) => patch(i, { unit: e.target.value })} className={INP} style={inputStyle} placeholder="unit" />
                <div className="flex items-center gap-1">
                  <span className="text-[13px]" style={{ color: "var(--muted)" }}>$</span>
                  <input value={r.cost} onChange={(e) => patch(i, { cost: e.target.value })} className={INP} style={inputStyle} placeholder="0.00" inputMode="decimal" />
                </div>
                <select
                  value={r.ingredientId}
                  onChange={(e) => patch(i, { ingredientId: e.target.value })}
                  className={INP}
                  style={inputStyle}
                >
                  <option value="">＋ New ingredient</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={save}
              disabled={pending || includedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
              style={btnPrimary}
            >
              <Check size={15} /> {pending ? "Adding…" : `Add ${includedCount} to inventory`}
            </button>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              Mapped lines update that ingredient&apos;s stock &amp; cost; new ones are created.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

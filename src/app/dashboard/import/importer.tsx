"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Upload, FileText, Check, AlertTriangle, Download, ChefHat, Users, Repeat } from "lucide-react";
import { parseCsvRecords } from "@/lib/csv";
import { runImport, type ImportKind, type ImportResult } from "./actions";

const KINDS: { id: ImportKind; label: string; icon: typeof ChefHat; cols: string; template: string }[] = [
  {
    id: "menu",
    label: "Menu",
    icon: ChefHat,
    cols: "name, price, diet, description, calories, protein, carbs, fat, allergens",
    template:
      "name,price,diet,description,calories,protein,carbs,fat,allergens\n" +
      "BBQ Chicken Bowl,12.50,High Protein,Smoky grilled chicken & rice,540,42,48,16,\n" +
      'Salmon Poke,14.00,Low Carb,"Fresh salmon, greens",430,32,20,18,fish',
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    cols: "name, email, phone, dietaryPrefs, allergens",
    template:
      "name,email,phone,dietaryPrefs,allergens\n" +
      "Jane Doe,jane@example.com,555-0101,high protein,dairy\n" +
      "Sam Lee,sam@example.com,555-0102,,fish;nuts",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    icon: Repeat,
    cols: "email, plan, frequency",
    template:
      "email,plan,frequency\n" +
      "jane@example.com,Pro,weekly\n" +
      "sam@example.com,Starter,biweekly",
  },
];

export function Importer() {
  const [kind, setKind] = useState<ImportKind>("menu");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const active = KINDS.find((k) => k.id === kind)!;

  const preview = useMemo(() => {
    if (!text.trim()) return { rows: [] as Record<string, string>[], headers: [] as string[] };
    const rows = parseCsvRecords(text);
    return { rows, headers: rows.length ? Object.keys(rows[0]) : [] };
  }, [text]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const doImport = () => {
    setResult(null);
    startTransition(async () => setResult(await runImport(kind, text)));
  };

  const downloadTemplate = () => {
    const blob = new Blob([active.template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prepflow-${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Type picker */}
      <div className="inline-flex p-0.5 rounded-lg flex-wrap" style={{ background: "var(--sand)", border: "1px solid var(--line)" }}>
        {KINDS.map((k) => {
          const on = kind === k.id;
          return (
            <button
              key={k.id}
              onClick={() => {
                setKind(k.id);
                setResult(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[13px] font-medium transition-colors"
              style={{
                background: on ? "var(--surface)" : "transparent",
                color: on ? "var(--ink)" : "var(--muted)",
                boxShadow: on ? "0 1px 2px rgba(31,30,26,.06)" : "none",
              }}
            >
              <k.icon size={15} />
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border p-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
            Columns: <code className="text-[12px]" style={{ color: "var(--ink)" }}>{active.cols}</code>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <Download size={14} /> Template
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <Upload size={14} /> Upload .csv
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={9}
          placeholder={`Paste CSV here, or upload a file.\n\n${active.template}`}
          className="w-full px-3 py-2.5 rounded-md border text-[12.5px] font-mono outline-none resize-y"
          style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
        />

        {/* Preview */}
        {preview.rows.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
              <FileText size={13} /> {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} detected — preview:
            </div>
            <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--line)" }}>
              <table className="text-[12px] w-full">
                <thead>
                  <tr style={{ background: "var(--paper)" }}>
                    {preview.headers.map((h) => (
                      <th key={h} className="text-left px-2.5 py-1.5 font-semibold" style={{ color: "var(--ink-soft)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      {preview.headers.map((h) => (
                        <td key={h} className="px-2.5 py-1.5 truncate max-w-[160px]" style={{ color: "var(--ink)" }}>
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={doImport}
            disabled={pending || preview.rows.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            <Upload size={15} /> {pending ? "Importing…" : `Import ${preview.rows.length || ""} ${active.label.toLowerCase()}`}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border p-5 fade" style={cardStyle}>
          {result.message && !result.ok ? (
            <p className="text-[13px] flex items-center gap-2" style={{ color: "var(--clay)" }}>
              <AlertTriangle size={15} /> {result.message}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Check size={16} style={{ color: "var(--pine)" }} />
                <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                  Import complete
                </span>
              </div>
              <div className="flex gap-5 text-[13px] mb-1">
                <span style={{ color: "var(--ink)" }}>
                  <strong>{result.created}</strong> created
                </span>
                <span style={{ color: "var(--ink)" }}>
                  <strong>{result.updated}</strong> updated
                </span>
                <span style={{ color: result.skipped ? "var(--clay)" : "var(--muted)" }}>
                  <strong>{result.skipped}</strong> skipped
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                  <div className="text-[12px] mb-1.5" style={{ color: "var(--muted)" }}>
                    Rows skipped:
                  </div>
                  <ul className="space-y-1">
                    {result.errors.slice(0, 12).map((e, i) => (
                      <li key={i} className="text-[12px]" style={{ color: "var(--clay)" }}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                    {result.errors.length > 12 && (
                      <li className="text-[12px]" style={{ color: "var(--muted)" }}>
                        …and {result.errors.length - 12} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(31,30,26,.03)",
} as const;

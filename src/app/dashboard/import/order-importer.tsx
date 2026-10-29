"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Check, AlertTriangle, Download, History, Trash2 } from "lucide-react";
import { parseCsvRecords } from "@/lib/csv";
import { buildOrderImport, chunkOrders, ORDER_IMPORT_TEMPLATE, ORDER_SOURCE_LABEL } from "@/lib/order-import";
import { formatCents } from "@/lib/money";
import { matchMealNames, startOrderImport, importOrderChunk, finishOrderImport, deleteOrderImport, type OrderChunkResult } from "./order-actions";

export type ImportBatchRow = {
  id: string;
  fileName: string | null;
  source: string | null;
  orderCount: number;
  lineCount: number;
  revenueCents: number;
  firstDate: string | null;
  lastDate: string | null;
  createdAt: string;
};

const fmtDay = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso)) : "—");

type RunState =
  | { phase: "idle" }
  | { phase: "running"; done: number; total: number }
  | { phase: "done"; totals: OrderChunkResult; total: number }
  | { phase: "error"; message: string };

/**
 * Order history: months of a kitchen's real sales from its previous platform,
 * parsed in the browser and uploaded in chunks so a big export never trips a
 * request limit. Imported orders feed P&L, analytics, menu engineering and
 * retention, but never the plan's order allowance.
 */
export function OrderImporter({ batches }: { batches: ImportBatchRow[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [unmatchedFor, setUnmatchedFor] = useState<{ key: string; names: string[] } | null>(null);
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [undoing, setUndoing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const build = useMemo(() => (text.trim() ? buildOrderImport(parseCsvRecords(text)) : null), [text]);
  const mealNames = useMemo(() => (build ? Object.keys(build.summary.mealUnits) : []), [build]);
  const mealKey = mealNames.join("\u0000");

  // Which items in the file have no meal yet — asked once per distinct set of
  // names; the answer is keyed to that set so a stale reply is never shown.
  useEffect(() => {
    if (!mealNames.length) return;
    let alive = true;
    const key = mealKey;
    matchMealNames(mealNames.slice(0, 3000))
      .then((r) => alive && setUnmatchedFor({ key, names: r.unmatched }))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealKey]);
  const unmatched = unmatchedFor && unmatchedFor.key === mealKey ? unmatchedFor.names : null;

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFileName(file.name);
      setRun({ phase: "idle" });
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([ORDER_IMPORT_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prepflow-order-history-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    if (!build || build.orders.length === 0) return;
    const chunks = chunkOrders(build.orders);
    setRun({ phase: "running", done: 0, total: build.orders.length });
    const totals: OrderChunkResult = { created: 0, skipped: 0, guests: 0, createdMeals: [], createdCustomers: 0, unmatchedMeals: [] };
    try {
      const { batchId } = await startOrderImport({ fileName, source: build.source, orderCount: build.orders.length, lineCount: build.summary.lines });
      let done = 0;
      for (const chunk of chunks) {
        const r = await importOrderChunk(batchId, chunk, { createMissingMeals: createMissing });
        if (r.error) throw new Error(r.error);
        totals.created += r.created;
        totals.skipped += r.skipped;
        totals.guests += r.guests;
        totals.createdCustomers += r.createdCustomers;
        totals.createdMeals.push(...r.createdMeals);
        for (const n of r.unmatchedMeals) if (!totals.unmatchedMeals.includes(n)) totals.unmatchedMeals.push(n);
        done += chunk.length;
        setRun({ phase: "running", done, total: build.orders.length });
      }
      await finishOrderImport(batchId);
      setRun({ phase: "done", totals, total: build.orders.length });
      router.refresh();
    } catch (e) {
      setRun({ phase: "error", message: e instanceof Error ? e.message : "Import failed. Nothing else was changed; try again." });
      router.refresh();
    }
  };

  const undo = async (b: ImportBatchRow) => {
    const ok = window.confirm(`Remove the ${b.orderCount} imported order${b.orderCount === 1 ? "" : "s"} from ${fmtDay(b.createdAt)}? Customers and meals created by the import stay.`);
    if (!ok) return;
    setUndoing(b.id);
    await deleteOrderImport(b.id);
    setUndoing(null);
    router.refresh();
  };

  const s = build?.summary;
  const unmatchedUnits = unmatched && s ? unmatched.reduce((a, n) => a + (s.mealUnits[n] ?? 0), 0) : 0;
  const busy = run.phase === "running";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
            Columns: <code className="text-[12px]" style={{ color: "var(--ink)" }}>order, date, email, customer, meal, qty, price, status, fulfillment, postal, tax, fees, total</code>
            <span className="block text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
              One row per line item. Drop a Shopify, WooCommerce or Square orders export in as-is &mdash; we map the columns. Months of real sales become your P&amp;L, analytics and menu engineering from day one.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              <Download size={14} /> Template
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
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
            setFileName(null);
            setRun({ phase: "idle" });
          }}
          rows={9}
          placeholder={`Paste CSV here, or upload a file.\n\n${ORDER_IMPORT_TEMPLATE}`}
          className="w-full px-3 py-2.5 rounded-md border text-[12.5px] font-mono outline-none resize-y"
          style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }}
        />

        {build && s && (
          <div className="mt-3 space-y-3">
            {(build.source !== "generic" || Object.keys(build.mapped).length > 0 || build.missing.length > 0) && (
              <div className="rounded-lg border px-3.5 py-2.5 text-[12.5px]" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink-soft)" }}>
                {build.source !== "generic" && (
                  <span>
                    Looks like a <strong style={{ color: "var(--ink)" }}>{ORDER_SOURCE_LABEL[build.source]}</strong>.{" "}
                  </span>
                )}
                {Object.keys(build.mapped).length > 0 && (
                  <span>
                    We&apos;ll read{" "}
                    {Object.entries(build.mapped).map(([col, from], i) => (
                      <span key={col}>
                        {i > 0 ? ", " : ""}
                        <code>{from}</code> as <code>{col}</code>
                      </span>
                    ))}
                    .{" "}
                  </span>
                )}
                {build.missing.length > 0 && (
                  <span style={{ color: "var(--clay)" }}>
                    Couldn&apos;t find a column for: {build.missing.join(", ")}. Add it, or rename a column to match.
                  </span>
                )}
              </div>
            )}

            {build.orders.length > 0 && (
              <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--line)" }}>
                <div className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                  <FileText size={13} /> What we read:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <Stat label="Orders" value={String(s.orders)} />
                  <Stat label="Line items" value={String(s.lines)} />
                  <Stat label="Customers" value={String(s.customers)} />
                  <Stat label="Sales" value={formatCents(s.revenueCents)} />
                  <Stat label="Period" value={`${fmtDay(s.firstDate)} – ${fmtDay(s.lastDate)}`} small />
                </div>
                {unmatched && unmatched.length > 0 && (
                  <div className="mt-3 pt-3 text-[12.5px]" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                    <div>
                      <strong style={{ color: "var(--ink)" }}>
                        {unmatched.length} item{unmatched.length === 1 ? "" : "s"}
                      </strong>{" "}
                      in the file ({unmatchedUnits} units) {unmatched.length === 1 ? "doesn't" : "don't"} match a meal in your menu:{" "}
                      {unmatched.slice(0, 6).map((n, i) => (
                        <span key={n}>
                          {i > 0 ? ", " : ""}
                          <code>{n}</code>
                        </span>
                      ))}
                      {unmatched.length > 6 ? ` and ${unmatched.length - 6} more` : ""}.
                    </div>
                    <label className="mt-2 flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="mt-0.5" />
                      <span>
                        Create them as hidden menu items, so cost and menu engineering can use them. Without this, their sales still count as revenue but can&apos;t be costed.
                      </span>
                    </label>
                  </div>
                )}
                {build.skipped.length > 0 && (
                  <div className="mt-3 pt-3 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
                    {build.skipped.length} row{build.skipped.length === 1 ? "" : "s"} will be left out:{" "}
                    {build.skipped.slice(0, 4).map((k, i) => (
                      <span key={i}>
                        {i > 0 ? "; " : ""}row {k.row} ({k.message})
                      </span>
                    ))}
                    {build.skipped.length > 4 ? "; …" : ""}
                  </div>
                )}
              </div>
            )}

            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Imported orders are history: no emails go out, nothing lands in production, and they never count toward your plan&apos;s order allowance. Orders keep their original dates, so switch Analytics and Profitability to &ldquo;90 days&rdquo; or &ldquo;12 months&rdquo; to see them. Customers in the file are added to your list; if win-back emails are on, customers whose last order is older than your quiet period may get one on the next daily run.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={doImport}
            disabled={busy || !build || build.orders.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            <Upload size={15} /> {busy ? `Importing ${run.done} of ${run.total}…` : `Import ${build?.orders.length || ""} order${build?.orders.length === 1 ? "" : "s"}`}
          </button>
          {busy && (
            <div className="flex-1 max-w-[280px] h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sand)" }}>
              <div className="h-full transition-all" style={{ width: `${Math.round((run.done / Math.max(1, run.total)) * 100)}%`, background: "var(--pine)" }} />
            </div>
          )}
        </div>
      </div>

      {run.phase === "error" && (
        <div className="rounded-xl border p-5 fade" style={cardStyle}>
          <p className="text-[13px] flex items-center gap-2" style={{ color: "var(--clay)" }}>
            <AlertTriangle size={15} /> {run.message} Orders already saved are listed below; undo them there if you want to start over.
          </p>
        </div>
      )}

      {run.phase === "done" && (
        <div className="rounded-xl border p-5 fade" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <Check size={16} style={{ color: "var(--pine)" }} />
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Import complete
            </span>
          </div>
          <div className="flex gap-5 text-[13px] mb-1 flex-wrap">
            <span style={{ color: "var(--ink)" }}>
              <strong>{run.totals.created}</strong> order{run.totals.created === 1 ? "" : "s"} added
            </span>
            <span style={{ color: run.totals.skipped ? "var(--clay)" : "var(--muted)" }}>
              <strong>{run.totals.skipped}</strong> already imported
            </span>
            <span style={{ color: "var(--ink)" }}>
              <strong>{run.totals.createdCustomers}</strong> new customer{run.totals.createdCustomers === 1 ? "" : "s"}
            </span>
            {run.totals.createdMeals.length > 0 && (
              <span style={{ color: "var(--ink)" }}>
                <strong>{run.totals.createdMeals.length}</strong> hidden meal{run.totals.createdMeals.length === 1 ? "" : "s"} created
              </span>
            )}
            {run.totals.guests > 0 && (
              <span style={{ color: "var(--muted)" }}>
                <strong>{run.totals.guests}</strong> without an email (shown as Guest)
              </span>
            )}
          </div>
          {run.totals.createdMeals.length > 0 && (
            <p className="text-[12.5px] mt-2" style={{ color: "var(--ink-soft)" }}>
              Add a recipe to each new meal (Menu → meal → Edit) so Profitability can cost what you sold. They stay hidden from your storefront until you switch them on.
            </p>
          )}
          {run.totals.unmatchedMeals.length > 0 && (
            <p className="text-[12.5px] mt-2" style={{ color: "#8a6d1f" }}>
              {run.totals.unmatchedMeals.length} item{run.totals.unmatchedMeals.length === 1 ? "" : "s"} had no matching meal and {run.totals.unmatchedMeals.length === 1 ? "was" : "were"} saved by name only.
            </p>
          )}
        </div>
      )}

      {batches.length > 0 && (
        <div className="rounded-xl border p-5" style={cardStyle}>
          <div className="flex items-center gap-2 mb-3">
            <History size={15} style={{ color: "var(--muted)" }} />
            <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
              Past imports
            </span>
          </div>
          <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--line)" }}>
            <table className="text-[12.5px] w-full">
              <thead>
                <tr style={{ background: "var(--paper)" }}>
                  {["Imported", "File", "Orders", "Line items", "Sales", "Period", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-1.5 font-semibold whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid var(--line)", color: "var(--ink)" }}>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDay(b.createdAt)}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate" style={{ color: "var(--ink-soft)" }}>
                      {b.fileName ?? "pasted"}
                      {b.source && b.source !== "generic" ? ` · ${b.source}` : ""}
                    </td>
                    <td className="px-3 py-2">{b.orderCount}</td>
                    <td className="px-3 py-2">{b.lineCount}</td>
                    <td className="px-3 py-2">{formatCents(b.revenueCents)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--ink-soft)" }}>
                      {fmtDay(b.firstDate)} – {fmtDay(b.lastDate)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => undo(b)}
                        disabled={undoing === b.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium border disabled:opacity-50"
                        style={{ borderColor: "var(--line)", color: "var(--clay)" }}
                        title="Remove every order from this import"
                      >
                        <Trash2 size={12} /> {undoing === b.id ? "Removing…" : "Undo"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className={small ? "text-[12.5px] font-medium" : "disp text-[18px] font-medium"} style={{ color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

const cardStyle = {
  borderColor: "var(--line)",
  background: "var(--surface)",
  boxShadow: "0 1px 2px rgba(31,30,26,.03)",
} as const;

"use client";

import { useActionState } from "react";
import { Plus, Trash2, Check, Users, Building2 } from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { formatCents, bpsToPercent } from "@/lib/money";
import { CATEGORY_META, type CostCategory } from "@/lib/operating-costs";
import {
  addOperatingCost,
  updateOperatingCost,
  deleteOperatingCost,
  type CostActionState,
} from "./actions";

export type CostRow = { id: string; label: string; category: CostCategory; monthlyCents: number };

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

function pctOfSales(monthlyCents: number, monthlyRevenueCents: number): string | null {
  if (monthlyRevenueCents <= 0) return null;
  return `${bpsToPercent(Math.round((monthlyCents / monthlyRevenueCents) * 10000)).toFixed(0)}% of sales`;
}

function CostLine({ row, monthlyRevenueCents }: { row: CostRow; monthlyRevenueCents: number }) {
  const share = pctOfSales(row.monthlyCents, monthlyRevenueCents);
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
    >
      <form action={updateOperatingCost} className="flex items-center gap-2 flex-1 min-w-0">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="category" value={row.category} />
        <input
          name="label"
          defaultValue={row.label}
          className={`${INP} flex-1 min-w-0`}
          style={inputStyle}
          aria-label="Cost name"
        />
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>$</span>
          <input
            name="monthly"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(row.monthlyCents / 100).toFixed(2)}
            className={`${INP} w-24 text-right`}
            style={inputStyle}
            aria-label="Monthly amount"
          />
          <span className="text-[11.5px] whitespace-nowrap" style={{ color: "var(--muted)" }}>/mo</span>
        </div>
        <span className="text-[11px] w-24 text-right shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
          {share ?? ""}
        </span>
        <button
          type="submit"
          className="shrink-0 px-2.5 py-1.5 rounded-md text-[12px] font-medium"
          style={{ background: "var(--paper-2, #efe9dd)", color: "var(--ink)" }}
          title="Save changes to this line"
        >
          Save
        </button>
      </form>
      <form action={deleteOperatingCost}>
        <input type="hidden" name="id" value={row.id} />
        <button
          type="submit"
          className="shrink-0 grid place-items-center w-8 h-8 rounded-md"
          style={{ color: "var(--clay)" }}
          title="Remove this cost"
          aria-label="Remove"
        >
          <Trash2 size={15} />
        </button>
      </form>
    </div>
  );
}

function CategorySection({
  category,
  rows,
  monthlyRevenueCents,
}: {
  category: CostCategory;
  rows: CostRow[];
  monthlyRevenueCents: number;
}) {
  const meta = CATEGORY_META[category];
  const total = rows.reduce((s, r) => s + r.monthlyCents, 0);
  const share = pctOfSales(total, monthlyRevenueCents);
  const Icon = category === "labor" ? Users : Building2;
  return (
    <Card>
      <CardTitle
        icon={<Icon size={15} />}
        title={`${meta.label} — ${formatCents(total)}/mo`}
        note={share ?? undefined}
      />
      <p className="text-[12px] mb-3 -mt-2" style={{ color: "var(--muted)" }}>
        {meta.blurb}
      </p>
      {rows.length === 0 ? (
        <p className="text-[12.5px] mb-1" style={{ color: "var(--muted)" }}>
          No {meta.label.toLowerCase()} costs yet — add one below.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <CostLine key={r.id} row={r} monthlyRevenueCents={monthlyRevenueCents} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function CostsManager({
  rows,
  monthlyRevenueCents,
}: {
  rows: CostRow[];
  monthlyRevenueCents: number;
}) {
  const [state, formAction, pending] = useActionState<CostActionState, FormData>(addOperatingCost, {
    ok: false,
  });
  const errors = state.errors ?? {};

  const labor = rows.filter((r) => r.category === "labor");
  const overhead = rows.filter((r) => r.category === "overhead");

  return (
    <div className="space-y-4">
      <CategorySection category="labor" rows={labor} monthlyRevenueCents={monthlyRevenueCents} />
      <CategorySection category="overhead" rows={overhead} monthlyRevenueCents={monthlyRevenueCents} />

      {/* Add a new line */}
      <Card>
        <CardTitle icon={<Plus size={15} />} title="Add an operating cost" />
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <Field label="What is it?" className="flex-1 min-w-[180px]">
            <input name="label" placeholder="e.g. Rent, Head chef wages" className={INP} style={inputStyle} />
            {errors.label && <p className="text-[11.5px] mt-1" style={{ color: "var(--clay)" }}>{errors.label}</p>}
          </Field>
          <Field label="Type" className="w-40">
            <select name="category" defaultValue="overhead" className={INP} style={inputStyle}>
              <option value="labor">Labour</option>
              <option value="overhead">Overhead</option>
            </select>
          </Field>
          <Field label="Amount / month ($)" className="w-40">
            <input name="monthly" type="number" step="0.01" min="0" placeholder="0.00" className={INP} style={inputStyle} />
            {errors.monthly && <p className="text-[11.5px] mt-1" style={{ color: "var(--clay)" }}>{errors.monthly}</p>}
          </Field>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-medium disabled:opacity-60"
            style={btnPrimary}
          >
            <Plus size={15} /> {pending ? "Adding…" : "Add"}
          </button>
          {state.ok && state.message && (
            <span className="flex items-center gap-1 text-[13px]" style={{ color: "#5e7350" }}>
              <Check size={15} /> {state.message}
            </span>
          )}
        </form>
      </Card>
    </div>
  );
}

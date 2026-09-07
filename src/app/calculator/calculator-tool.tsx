"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";

const BOOK_DEMO =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ2IVtsCgKAaDwClQGL0ObL7F-2ZsvKvUaQ1jN7_yXGd5dVaRFm2SS6Gnq3iQkYzuhYBoOzbckrw";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });

const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;
const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

function Field({
  label,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium block mb-1" style={{ color: "var(--ink)" }}>{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
          style={inputStyle}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none" style={{ color: "var(--muted)" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export function CalculatorTool() {
  const [price, setPrice] = useState("14.00");
  const [proteinOz, setProteinOz] = useState("6");
  const [proteinLb, setProteinLb] = useState("8.00"); // $ per lb
  const [trim, setTrim] = useState("15"); // %
  const [other, setOther] = useState("2.00"); // $ other ingredients

  const n = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const priceN = n(price);
  const netOz = n(proteinOz);
  const perLb = n(proteinLb);
  const trimFrac = Math.min(n(trim), 95) / 100;
  const otherN = n(other);

  const perOz = perLb / 16;
  const grossOz = trimFrac < 1 ? netOz / (1 - trimFrac) : netOz;
  const proteinCost = grossOz * perOz;
  const trimCost = (grossOz - netOz) * perOz;
  const plateCost = proteinCost + otherN;
  const marginDollars = priceN - plateCost;
  const marginPct = priceN > 0 ? (marginDollars / priceN) * 100 : 0;
  const foodCostPct = priceN > 0 ? (plateCost / priceN) * 100 : 0;
  const losing = priceN > 0 && marginDollars < 0;

  const Stat = ({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) => (
    <div className="rounded-xl border p-3.5" style={card}>
      <div className="text-[11.5px] mb-1" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="disp text-[22px] font-medium leading-none" style={{ color: tone ?? "var(--ink)" }}>{value}</div>
      {hint && <div className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>{hint}</div>}
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 items-start">
      {/* Inputs */}
      <div className="rounded-2xl border p-5" style={card}>
        <h2 className="text-[15px] font-semibold mb-4" style={{ color: "var(--ink)" }}>Your dish</h2>
        <div className="space-y-3.5">
          <Field label="Selling price" suffix="$" value={price} onChange={setPrice} placeholder="14.00" />
          <div className="pt-3.5" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="text-[12px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--muted)" }}>Main protein</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Per meal" suffix="oz" value={proteinOz} onChange={setProteinOz} placeholder="6" />
              <Field label="You pay" suffix="$/lb" value={proteinLb} onChange={setProteinLb} placeholder="8.00" />
            </div>
            <div className="mt-3">
              <Field label="Trim / waste" suffix="%" value={trim} onChange={setTrim} placeholder="15" />
            </div>
          </div>
          <div className="pt-3.5" style={{ borderTop: "1px solid var(--line)" }}>
            <Field label="Other ingredients (per meal)" suffix="$" value={other} onChange={setOther} placeholder="2.00" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Stat label="Plate cost" value={money(plateCost)} hint={`${foodCostPct.toFixed(0)}% of your price`} />
          <Stat
            label="Margin per plate"
            value={money(marginDollars)}
            tone={losing ? "var(--clay)" : "var(--pine)"}
            hint={`${marginPct.toFixed(0)}% margin`}
          />
          <Stat label="Buy to net your portion" value={`${grossOz.toFixed(1)} oz`} hint={`to get ${netOz.toFixed(1)} oz after ${(trimFrac * 100).toFixed(0)}% trim`} />
          <Stat label="Lost to trim" value={money(trimCost)} tone="var(--clay)" hint="per plate you buy but toss" />
        </div>

        {losing ? (
          <div className="rounded-xl border p-3.5 mb-3 text-[13px]" style={{ ...card, borderColor: "var(--clay)", color: "var(--clay)" }}>
            This dish loses {money(-marginDollars)} every time you sell it. Raise the price, cut the cost, or fix the yield.
          </div>
        ) : (
          <div className="rounded-xl border p-3.5 mb-3 text-[13px]" style={card}>
            <span style={{ color: "var(--ink)" }}>
              At {money(priceN)} you keep <strong style={{ color: "var(--pine)" }}>{money(marginDollars)}</strong> per plate
              ({marginPct.toFixed(0)}% margin){trimCost > 0 ? <> — and <strong style={{ color: "var(--clay)" }}>{money(trimCost)}</strong> of every plate is bought only to be trimmed away.</> : "."}
            </span>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl border p-5" style={{ ...card, background: "color-mix(in srgb, var(--pine) 5%, var(--surface))" }}>
          <div className="text-[14px] font-semibold mb-1" style={{ color: "var(--ink)" }}>This is one dish. Now do it for your whole menu — automatically.</div>
          <p className="text-[13px] mb-3.5" style={{ color: "var(--ink-soft)" }}>
            PrepFlow runs this math on every meal from your real recipes and orders — margins, trim dollars, and what to buy.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[13.5px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
              Book a 15-min demo <ArrowRight size={15} />
            </a>
            <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[13.5px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}>
              Start free
            </Link>
            <Link href="/audit" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13.5px] font-medium" style={{ color: "var(--pine)" }}>
              <ClipboardCheck size={15} /> Profit Leak Audit
            </Link>
          </div>
        </div>
        <p className="text-[11px] mt-3 text-center" style={{ color: "var(--muted)" }}>
          Estimates for a single main protein + other-ingredient cost. Your real plate cost may include more ingredients — PrepFlow accounts for all of them.
        </p>
      </div>
    </div>
  );
}

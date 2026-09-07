"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check, AlertTriangle, RotateCcw, Calculator } from "lucide-react";

const BOOK_DEMO =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ2IVtsCgKAaDwClQGL0ObL7F-2ZsvKvUaQ1jN7_yXGd5dVaRFm2SS6Gnq3iQkYzuhYBoOzbckrw";

type Q = {
  id: string;
  question: string;
  // The answer that indicates a leak is `leakIndex`.
  options: [string, string];
  leakIndex: 0 | 1;
  leakTitle: string;
  leakWhy: string;
  fix: string;
};

const QUESTIONS: Q[] = [
  {
    id: "yield",
    question: "How do you price your dishes?",
    options: ["On the raw purchase weight", "On the trimmed / cooked yield"],
    leakIndex: 0,
    leakTitle: "Raw-weight pricing",
    leakWhy: "You pay for weight you trim and cook away, so your real food cost is higher than your invoice suggests.",
    fix: "PrepFlow costs each plate on usable (edible) yield after trim — so your margin is real, not a guess.",
  },
  {
    id: "portion",
    question: "How do you portion your proteins?",
    options: ["We weigh every portion", "We mostly eyeball it"],
    leakIndex: 1,
    leakTitle: "Portion creep",
    leakWhy: "Half an ounce extra per meal, times hundreds of meals, quietly becomes inventory you gave away for free.",
    fix: "PrepFlow ties recipes to exact quantities so production is built on the portions you actually costed.",
  },
  {
    id: "reprice",
    question: "When an ingredient's cost goes up, your menu prices…",
    options: ["Get reviewed to protect margin", "Usually stay the same"],
    leakIndex: 1,
    leakTitle: "Stale pricing",
    leakWhy: "Supplier prices drift up all year; if your menu price doesn't move, your margin silently shrinks.",
    fix: "PrepFlow flags meals whose margin dropped when a cost rose, and suggests the price to get back on target.",
  },
  {
    id: "waste",
    question: "At the end of a week, prepped food or ingredients…",
    options: ["Rarely go to waste", "Regularly get tossed or over-bought"],
    leakIndex: 1,
    leakTitle: "Waste & over-buying",
    leakWhy: "Food you bought but never sold is pure loss — it comes straight off the bottom line.",
    fix: "PrepFlow's trim-aware shopping list buys to actual demand, and the Waste log turns loss into a number you can manage.",
  },
  {
    id: "admin",
    question: "Your weekly production / prep list is…",
    options: ["Built from your orders automatically", "Rebuilt by hand in spreadsheets"],
    leakIndex: 1,
    leakTitle: "Manual admin",
    leakWhy: "Re-counting orders and rebuilding prep lists every week is hours of unpaid time — and a source of errors.",
    fix: "PrepFlow turns the orders you already took into the production and shopping lists automatically. Enter once, use everywhere.",
  },
];

export function AuditTool() {
  const [step, setStep] = useState(0); // 0..QUESTIONS.length-1, then results
  const [answers, setAnswers] = useState<(number | null)[]>(QUESTIONS.map(() => null));
  const done = step >= QUESTIONS.length;

  const answer = (optIdx: number) => {
    setAnswers((a) => a.map((v, i) => (i === step ? optIdx : v)));
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));
  const restart = () => {
    setAnswers(QUESTIONS.map(() => null));
    setStep(0);
  };

  const leaks = QUESTIONS.filter((q, i) => answers[i] === q.leakIndex);
  const score = leaks.length;

  const verdict =
    score === 0
      ? { head: "Tight ship. 👏", tone: "var(--pine)", body: "No obvious leaks from these five — you're running lean. PrepFlow can help you keep it that way as you grow." }
      : score <= 2
        ? { head: `${score} leak${score === 1 ? "" : "s"} found`, tone: "var(--clay)", body: "A couple of spots where margin is slipping. Each is fixable — and worth it at volume." }
        : { head: `${score} leaks found`, tone: "var(--clay)", body: "That's meaningful money leaking every week. The good news: every one of these is exactly what PrepFlow is built to close." };

  const card = { borderColor: "var(--line)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(31,30,26,.03)" } as const;

  if (!done) {
    const q = QUESTIONS[step];
    return (
      <div className="max-w-xl mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: i <= step ? "var(--pine)" : "var(--sand)" }}
            />
          ))}
        </div>
        <div className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
          Question {step + 1} of {QUESTIONS.length}
        </div>
        <h2 className="disp text-[24px] leading-tight font-medium mb-5" style={{ color: "var(--ink)" }}>
          {q.question}
        </h2>
        <div className="space-y-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              className="w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border transition-colors hover:border-[color:var(--pine)]"
              style={card}
            >
              <span className="text-[14.5px]" style={{ color: "var(--ink)" }}>{opt}</span>
              <ArrowRight size={16} style={{ color: "var(--muted)" }} />
            </button>
          ))}
        </div>
        {step > 0 && (
          <button onClick={back} className="mt-5 flex items-center gap-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
            <ArrowLeft size={14} /> Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Score */}
      <div className="rounded-2xl border p-6 text-center mb-5" style={card}>
        <div className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
          Your Profit Leak Score
        </div>
        <div className="disp text-[52px] leading-none font-medium mb-1" style={{ color: verdict.tone }}>
          {score}<span className="text-[28px]" style={{ color: "var(--muted)" }}>/{QUESTIONS.length}</span>
        </div>
        <div className="text-[17px] font-semibold mb-1" style={{ color: "var(--ink)" }}>{verdict.head}</div>
        <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>{verdict.body}</p>
      </div>

      {/* Leak breakdown */}
      {leaks.length > 0 && (
        <div className="space-y-3 mb-5">
          {leaks.map((q) => (
            <div key={q.id} className="rounded-xl border p-4" style={card}>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle size={15} style={{ color: "var(--clay)" }} />
                <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{q.leakTitle}</span>
              </div>
              <p className="text-[12.5px] mb-2" style={{ color: "var(--muted)" }}>{q.leakWhy}</p>
              <p className="text-[12.5px] flex items-start gap-1.5" style={{ color: "var(--pine)" }}>
                <Check size={14} style={{ marginTop: 1, flexShrink: 0 }} /> {q.fix}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="rounded-2xl border p-6 text-center" style={{ ...card, background: "color-mix(in srgb, var(--pine) 5%, var(--surface))" }}>
        <h3 className="disp text-[20px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>
          See these leaks on your own menu
        </h3>
        <p className="text-[13.5px] mb-4" style={{ color: "var(--ink-soft)" }}>
          We'll build your kitchen in PrepFlow and show you the real numbers — free for 30 days, no card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <a
            href={BOOK_DEMO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-[14px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            Book a 15-min demo <ArrowRight size={16} />
          </a>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-[14px] font-medium border"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "var(--surface)" }}
          >
            Start free
          </Link>
        </div>
        <div className="mt-4 pt-4 flex items-center justify-center gap-4 flex-wrap text-[12.5px]" style={{ borderTop: "1px solid var(--line)" }}>
          <Link href="/calculator" className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--pine)" }}>
            <Calculator size={14} /> Try the Recipe Profit Calculator
          </Link>
          <button onClick={restart} className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <RotateCcw size={13} /> Retake the audit
          </button>
        </div>
      </div>
    </div>
  );
}

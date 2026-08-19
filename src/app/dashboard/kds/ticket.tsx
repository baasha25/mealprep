"use client";

import { useOptimistic, useTransition } from "react";
import { Check, ArrowRight, RotateCcw } from "lucide-react";
import { bumpTicket } from "./actions";

type Status = "todo" | "cooking" | "done";
const NEXT: Record<Status, Status> = { todo: "cooking", cooking: "done", done: "todo" };
// The call-to-action shown on each ticket, so it's obvious a tap advances it.
const CTA: Record<Status, { label: string; reset?: boolean }> = {
  todo: { label: "Tap to start" },
  cooking: { label: "Tap to mark done" },
  done: { label: "Tap to reset", reset: true },
};
type StatusStyle = { label: string; card: string; border: string; accent: string };

/**
 * A production ticket that advances on a SINGLE tap, with optimistic feedback so
 * the status flips instantly (no waiting on the server round-trip → no "it did
 * nothing, tap again" double-tap feel).
 */
export function Ticket({
  id,
  mealName,
  qty,
  status,
  styles,
}: {
  id: string;
  mealName: string;
  qty: number;
  status: Status;
  styles: Record<Status, StatusStyle>;
}) {
  const [optStatus, setOpt] = useOptimistic<Status>(status);
  const [pending, start] = useTransition();
  const s = styles[optStatus];
  const done = optStatus === "done";
  const cta = CTA[optStatus];

  const onTap = () =>
    start(async () => {
      setOpt(NEXT[optStatus]);
      await bumpTicket(id);
    });

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left rounded-xl border p-3.5 transition-transform active:scale-[0.97] hover:brightness-[0.985]"
      style={{
        background: s.card,
        borderColor: s.border,
        borderWidth: optStatus === "todo" ? 1 : 1.5,
        opacity: pending ? 0.9 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="disp text-[26px] font-medium leading-none" style={{ color: done ? "var(--muted)" : "var(--ink)" }}>
          {qty}
        </span>
        {/* Filled status pill — clearer than plain text at a glance across the line. */}
        <span
          className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
          style={{ color: "#fff", background: s.accent }}
        >
          {done && <Check size={12} />} {s.label}
        </span>
      </div>
      <div
        className="mt-1.5 text-[13.5px] font-medium leading-snug"
        style={{ color: done ? "var(--muted)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}
      >
        {mealName}
      </div>
      {/* Explicit affordance so it reads as tappable, not just a label. */}
      <div
        className="mt-2.5 pt-2 flex items-center justify-between text-[11.5px] font-semibold"
        style={{ borderTop: `1px solid ${s.border}`, color: s.accent }}
      >
        <span>{cta.label}</span>
        {cta.reset ? <RotateCcw size={14} /> : <ArrowRight size={14} />}
      </div>
    </button>
  );
}

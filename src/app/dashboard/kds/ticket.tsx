"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { bumpTicket } from "./actions";

type Status = "todo" | "cooking" | "done";
const NEXT: Record<Status, Status> = { todo: "cooking", cooking: "done", done: "todo" };
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

  const onTap = () =>
    start(async () => {
      setOpt(NEXT[optStatus]);
      await bumpTicket(id);
    });

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left rounded-xl border p-3.5 transition-transform active:scale-[0.98]"
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
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: s.accent }}>
          {done && <Check size={12} />} {s.label}
        </span>
      </div>
      <div
        className="mt-1.5 text-[13.5px] font-medium leading-snug"
        style={{ color: done ? "var(--muted)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}
      >
        {mealName}
      </div>
    </button>
  );
}

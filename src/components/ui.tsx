import type { ReactNode } from "react";

/* Shared presentational primitives ported from the Vite demo's design system.
   No hooks → safe to use in server or client components. */

export const btnPrimary = { background: "var(--pine)", color: "#f4f2ec" } as const;
export const INP =
  "w-full px-3 py-2 rounded-md border text-[13px] outline-none";

export function Page({ children }: { children: ReactNode }) {
  return <div className="fade px-9 py-8 max-w-6xl">{children}</div>;
}

export function Head({
  kicker,
  title,
  sub,
  right,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex items-end justify-between gap-4 mb-7 pb-5 flex-wrap"
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <div>
        {kicker && (
          <div
            className="text-[10.5px] font-semibold tracking-[0.16em] uppercase mb-2.5"
            style={{ color: "var(--muted)" }}
          >
            {kicker}
          </div>
        )}
        <h1
          className="disp text-[30px] leading-none font-medium"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h1>
        {sub && (
          <p className="text-[13.5px] mt-2.5" style={{ color: "var(--ink-soft)" }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{
        borderColor: "var(--line)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(31,30,26,.03)",
      }}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  icon,
  title,
  note,
}: {
  icon?: ReactNode;
  title: string;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--pine)" }}>{icon}</span>}
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </h3>
      </div>
      {note && (
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

export function Kpi({
  icon,
  label,
  value,
  delta,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  delta?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--line)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(31,30,26,.03)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span style={{ color: "var(--muted)" }}>{icon}</span>
        {delta && (
          <span
            className="text-[11.5px] font-medium"
            style={{ color: "#5e7350" }}
          >
            {delta}
          </span>
        )}
      </div>
      <div
        className="disp text-[24px] font-medium leading-none"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
      <div className="text-[12px] mt-1.5" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  className = "",
  hint,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      <label
        className="text-[12.5px] font-medium block mb-1.5"
        style={{ color: "var(--ink)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11.5px] mt-1" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Row({
  l,
  v,
  green,
}: {
  l: string;
  v: ReactNode;
  green?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--muted)" }}>{l}</span>
      <span style={{ color: green ? "var(--pine)" : "var(--ink)" }}>{v}</span>
    </div>
  );
}

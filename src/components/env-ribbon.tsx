// A small corner badge shown ONLY when NEXT_PUBLIC_ENV_LABEL is set (e.g. on the
// staging site). Production never sets it, so nothing renders there. Keeps
// testers from ever confusing staging with the live app. Non-interactive.
export function EnvRibbon() {
  const label = process.env.NEXT_PUBLIC_ENV_LABEL?.trim();
  if (!label) return null;
  return (
    <div
      aria-hidden
      className="no-print"
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 2147483000,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#fff",
        background: "#9a5142",
        boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#f4c542",
          display: "inline-block",
        }}
      />
      {label} · not live
    </div>
  );
}

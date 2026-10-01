// Instant skeleton while a dashboard page renders on the server. Pages here are
// dynamic (every click is a server round-trip), so without this a click feels
// dead for ~0.5–1s (or several seconds on a cold start). The shell paints
// immediately and the real page streams in.
export default function DashboardLoading() {
  const bar = (w: string, h = "h-3") => (
    <div className={`${h} rounded-md animate-pulse`} style={{ width: w, background: "var(--sand)" }} />
  );
  return (
    <div className="px-9 py-8 max-w-6xl" aria-busy="true" aria-label="Loading">
      <div className="mb-7 pb-5" style={{ borderBottom: "1px solid var(--line)" }}>
        {bar("90px", "h-2.5")}
        <div className="mt-3">{bar("260px", "h-6")}</div>
        <div className="mt-3">{bar("380px")}</div>
      </div>
      <div className="grid sm:grid-cols-4 gap-3.5 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            {bar("16px", "h-4")}
            <div className="mt-5">{bar("70px", "h-6")}</div>
            <div className="mt-2">{bar("110px", "h-2.5")}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        {bar("180px", "h-4")}
        {[0, 1, 2, 3, 4].map((i) => bar(`${92 - i * 7}%`))}
      </div>
    </div>
  );
}

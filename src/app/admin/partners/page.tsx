import Link from "next/link";
import { Handshake, ChevronRight } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { CreatePartnerForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  await requireSuperAdmin();

  const partners = await db.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { referredBusinesses: true } },
      commissions: { select: { amountCents: true, status: true } },
    },
  });

  const rows = partners.map((p) => {
    const pending = p.commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amountCents, 0);
    const paid = p.commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amountCents, 0);
    return { ...p, pending, paid };
  });

  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <Handshake size={20} style={{ color: "var(--pine)" }} />
        <h1 className="disp text-[22px] font-medium" style={{ color: "var(--ink)" }}>Partner Program</h1>
      </div>
      <p className="text-[13.5px] mb-6" style={{ color: "var(--muted)" }}>
        Referral partners earn a recurring commission on the software revenue of kitchens they send. Commissions accrue
        only when a referred kitchen actually pays — never during the free trial. Payouts are manual: you approve each one.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-7 max-w-lg">
        <Stat label="Partners" value={String(rows.length)} />
        <Stat label="Pending payout" value={formatCents(totalPending)} accent="var(--clay)" />
        <Stat label="Paid to date" value={formatCents(totalPaid)} />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Partners</h2>
          {rows.length === 0 ? (
            <p className="text-[14px] py-8 text-center rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
              No partners yet — add your first one on the right.
            </p>
          ) : (
            <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {rows.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/partners/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-medium truncate" style={{ color: "var(--ink)" }}>{p.name}</span>
                      <code className="text-[11.5px] px-1.5 py-0.5 rounded" style={{ background: "var(--sand)", color: "var(--ink-soft)" }}>?ref={p.code}</code>
                      {p.status === "paused" && (
                        <span className="text-[10.5px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold" style={{ background: "#00000010", color: "var(--muted)" }}>Paused</span>
                      )}
                    </div>
                    <div className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>
                      {p._count.referredBusinesses} kitchen{p._count.referredBusinesses === 1 ? "" : "s"} · {(p.commissionBps / 100).toFixed(p.commissionBps % 100 ? 1 : 0)}% · {p.payoutsEnabled ? "payouts ready" : "onboarding pending"}
                    </div>
                  </div>
                  {p.pending > 0 && (
                    <span className="text-[13px] font-semibold" style={{ color: "var(--clay)" }}>{formatCents(p.pending)}</span>
                  )}
                  <ChevronRight size={16} style={{ color: "var(--muted)" }} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Add a partner</h2>
          <CreatePartnerForm />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="text-[11.5px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-[19px] font-semibold mt-0.5" style={{ color: accent ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}

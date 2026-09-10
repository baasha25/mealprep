import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { appUrl } from "@/lib/app-url";
import { PartnerAdmin } from "./partner-admin";

export const dynamic = "force-dynamic";

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;

  const partner = await db.partner.findUnique({
    where: { id },
    include: {
      referredBusinesses: { select: { id: true, name: true, tier: true, billingStatus: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      commissions: {
        orderBy: { createdAt: "desc" },
        include: { business: { select: { name: true } } },
      },
    },
  });
  if (!partner) notFound();

  const pending = partner.commissions.filter((c) => c.status === "pending");
  const pendingTotal = pending.reduce((s, c) => s + c.amountCents, 0);
  const paidTotal = partner.commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amountCents, 0);

  const origin = (await appUrl()) || "https://prepflow.ca";
  const refLink = `${origin}/?ref=${partner.code}`;
  const statsLink = `${origin}/partner/${partner.statsToken}`;

  const fmtDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

  return (
    <div>
      <Link href="/admin/partners" className="inline-flex items-center gap-1.5 text-[13px] mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> All partners
      </Link>

      <div className="flex items-center gap-2.5 flex-wrap mb-1">
        <h1 className="disp text-[22px] font-medium" style={{ color: "var(--ink)" }}>{partner.name}</h1>
        <code className="text-[12px] px-1.5 py-0.5 rounded" style={{ background: "var(--sand)", color: "var(--ink-soft)" }}>?ref={partner.code}</code>
        {partner.status === "paused" && (
          <span className="text-[10.5px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold" style={{ background: "#00000010", color: "var(--muted)" }}>Paused</span>
        )}
      </div>
      <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
        {partner.company ? `${partner.company} · ` : ""}{partner.email} · {(partner.commissionBps / 100).toFixed(partner.commissionBps % 100 ? 1 : 0)}% recurring
      </p>

      <div className="grid grid-cols-3 gap-3 mb-7 max-w-lg">
        <Stat label="Referred kitchens" value={String(partner.referredBusinesses.length)} />
        <Stat label="Pending payout" value={formatCents(pendingTotal)} accent="var(--clay)" />
        <Stat label="Paid to date" value={formatCents(paidTotal)} />
      </div>

      <PartnerAdmin
        id={partner.id}
        status={partner.status as "active" | "paused"}
        payoutsEnabled={partner.payoutsEnabled}
        hasStripeAccount={Boolean(partner.stripeAccountId)}
        pendingTotal={pendingTotal}
        refLink={refLink}
        statsLink={statsLink}
      />

      <div className="grid lg:grid-cols-2 gap-8 mt-8 items-start">
        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Referred kitchens</h2>
          {partner.referredBusinesses.length === 0 ? (
            <Empty>No kitchens have signed up through this link yet.</Empty>
          ) : (
            <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {partner.referredBusinesses.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[14px]" style={{ color: "var(--ink)" }}>{b.name}</span>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}>{b.tier} · {b.billingStatus} · {fmtDate.format(b.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted)" }}>Commission ledger</h2>
          {partner.commissions.length === 0 ? (
            <Empty>No commissions yet — they accrue when a referred kitchen pays a software invoice.</Empty>
          ) : (
            <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {partner.commissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-[13.5px]" style={{ color: "var(--ink)" }}>{c.business.name}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{c.periodMonth} · on {formatCents(c.baseAmountCents)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{formatCents(c.amountCents)}</div>
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: c.status === "paid" ? "var(--pine)" : c.status === "void" ? "var(--muted)" : "var(--clay)" }}>{c.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] py-6 text-center rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>{children}</p>;
}

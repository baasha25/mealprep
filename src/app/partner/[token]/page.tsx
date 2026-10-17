import { notFound } from "next/navigation";
import { Leaf } from "lucide-react";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { appUrl } from "@/lib/app-url";
import { CopyLink } from "./copy-link";

export const dynamic = "force-dynamic";

// Read-only stats page for a partner — reached via an unguessable token, so it
// needs no login. Shows their link, referrals, and earnings.
export default async function PartnerStatsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const partner = await db.partner.findUnique({
    where: { statsToken: token },
    include: {
      _count: { select: { referredBusinesses: true } },
      commissions: { select: { amountCents: true, status: true, kind: true } },
    },
  });
  if (!partner) notFound();

  const paid = partner.commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amountCents, 0);
  const pending = partner.commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amountCents, 0);
  const byKind = (kind: string) => partner.commissions.filter((c) => c.kind === kind && c.status !== "void").reduce((s, c) => s + c.amountCents, 0);
  const pct = (bps: number) => `${bps / 100}%`;
  const origin = (await appUrl()) || "https://prepflow.ca";
  const refLink = `${origin}/?ref=${partner.code}`;

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <div className="max-w-xl mx-auto px-5 py-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="grid place-items-center w-7 h-7 rounded-md" style={{ background: "var(--pine)" }}>
            <Leaf size={15} color="#f4f2ec" />
          </div>
          <span className="disp text-[17px] font-medium" style={{ color: "var(--ink)" }}>PrepFlow</span>
          <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wide ml-1" style={{ background: "var(--sand)", color: "var(--ink-soft)" }}>Partner</span>
        </div>

        <h1 className="disp text-[24px] font-medium mb-1" style={{ color: "var(--ink)" }}>Hi {partner.name.split(" ")[0]} 👋</h1>
        <p className="text-[14px] mb-7" style={{ color: "var(--muted)" }}>
          Here's how your PrepFlow referrals are doing. You earn {pct(partner.commissionBps)} of each kitchen's monthly subscription and {pct(partner.feeShareBps)} of the platform fee on their sales, every month they stay{partner.activationBonusCents > 0 ? `, plus a ${formatCents(partner.activationBonusCents)} bonus when each kitchen pays its first invoice` : ""}{partner.stepUpAtKitchens > 0 ? `. Both shares rise to ${pct(partner.stepUpBps)} once ${partner.stepUpAtKitchens} of your kitchens are live` : ""}.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-7">
          <Stat label="Kitchens referred" value={String(partner._count.referredBusinesses)} />
          <Stat label="Earned to date" value={formatCents(paid)} accent="var(--pine)" />
          <Stat label="Pending" value={formatCents(pending)} accent="var(--clay)" />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-7">
          <Stat label="Subscription share" value={formatCents(byKind("subscription"))} />
          <Stat label="Platform-fee share" value={formatCents(byKind("platform_fee"))} />
          <Stat label="Activation bonuses" value={formatCents(byKind("activation_bonus"))} />
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="text-[12px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Your referral link</div>
          <CopyLink value={refLink} />
          <p className="text-[12.5px] mt-3" style={{ color: "var(--muted)" }}>
            Share this link. Any kitchen that signs up through it is credited to you automatically — commissions start the moment they become a paying customer.
          </p>
        </div>

        <p className="text-[11.5px] mt-6 text-center" style={{ color: "var(--muted)" }}>
          Questions about a payout? Reply to your PrepFlow partner email — we settle pending balances regularly.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-[18px] font-semibold mt-0.5" style={{ color: accent ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}

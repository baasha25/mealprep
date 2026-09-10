"use client";

import { useState, useTransition } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { startPartnerConnect, refreshPartnerConnect, payPartner, setPartnerStatus, type ActionResult } from "../actions";
import { formatCents } from "@/lib/money";

export function PartnerAdmin({
  id, status, payoutsEnabled, hasStripeAccount, pendingTotal, refLink, statsLink,
}: {
  id: string;
  status: "active" | "paused";
  payoutsEnabled: boolean;
  hasStripeAccount: boolean;
  pendingTotal: number;
  refLink: string;
  statsLink: string;
}) {
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (r.url) window.open(r.url, "_blank", "noopener");
    });
  }

  const canPay = payoutsEnabled && pendingTotal > 0;

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <CopyRow label="Referral link (send to partner)" value={refLink} />
        <CopyRow label="Partner stats page (read-only)" value={statsLink} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
        <span className="text-[12.5px] mr-1" style={{ color: "var(--muted)" }}>
          Payouts: {payoutsEnabled ? <b style={{ color: "var(--pine)" }}>ready</b> : hasStripeAccount ? "onboarding started" : "not set up"}
        </span>

        {!payoutsEnabled && (
          <Btn onClick={() => run(() => startPartnerConnect(id))} disabled={pending}>
            <ExternalLink size={13} /> {hasStripeAccount ? "Resume Stripe onboarding" : "Set up Stripe payouts"}
          </Btn>
        )}
        {hasStripeAccount && (
          <Btn onClick={() => run(() => refreshPartnerConnect(id))} disabled={pending} subtle>Re-check status</Btn>
        )}

        <div className="flex-1" />

        <Btn onClick={() => run(() => setPartnerStatus(id, status === "active" ? "paused" : "active"))} disabled={pending} subtle>
          {status === "active" ? "Pause partner" : "Reactivate"}
        </Btn>

        <button
          onClick={() => {
            if (confirm(`Send ${formatCents(pendingTotal)} to this partner's Stripe account now? This moves real money.`)) {
              run(() => payPartner(id));
            }
          }}
          disabled={pending || !canPay}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
          style={{ background: "var(--pine)", color: "#f4f2ec" }}
          title={!payoutsEnabled ? "Partner must finish Stripe onboarding first" : pendingTotal <= 0 ? "Nothing pending" : ""}
        >
          Approve &amp; pay {pendingTotal > 0 ? formatCents(pendingTotal) : ""}
        </button>
      </div>

      {msg && (
        <p className="text-[13px] mt-3" style={{ color: msg.ok ? "var(--pine)" : "var(--clay)" }}>{msg.message}</p>
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, subtle }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; subtle?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border disabled:opacity-50"
      style={{ borderColor: "var(--line)", background: subtle ? "transparent" : "var(--paper)", color: "var(--ink)" }}
    >
      {children}
    </button>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-[12.5px] px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink-soft)" }}>{value}</code>
        <button
          onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="grid place-items-center w-8 h-8 rounded-lg border shrink-0"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          title="Copy"
        >
          {copied ? <Check size={14} style={{ color: "var(--pine)" }} /> : <Copy size={14} style={{ color: "var(--ink-soft)" }} />}
        </button>
      </div>
    </div>
  );
}

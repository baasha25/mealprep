"use client";

import { useActionState, useState, useTransition } from "react";
import { Mail, Check, RefreshCw, Trash2, Copy } from "lucide-react";
import { Card, CardTitle, INP } from "@/components/ui";
import { DOMAIN_STATUS_LABEL, type DnsRecordView } from "@/lib/sender";
import { connectEmailDomain, checkEmailDomain, disconnectEmailDomain, saveEmailSender, type EmailDomainState } from "./actions";

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export type EmailDomainInitial = {
  enabled: boolean; // email configured on this deployment
  domain: string | null;
  status: string | null;
  records: DnsRecordView[];
  fromLocal: string;
  replyTo: string;
  ownerEmail: string;
  preview: string; // what customers see in From today
};

/**
 * Settings → Email sending: connect the kitchen's own domain so customer email
 * comes from hello@theirkitchen.ca instead of "via PrepFlow". Resend gives us
 * the DNS records; the owner adds them at their domain provider and checks.
 */
export function EmailDomainCard({ initial }: { initial: EmailDomainInitial }) {
  const [connectState, connect, connecting] = useActionState<EmailDomainState, FormData>(connectEmailDomain, null);
  const [prefsState, savePrefs, savingPrefs] = useActionState<EmailDomainState, FormData>(saveEmailSender, null);
  const [note, setNote] = useState<EmailDomainState>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const msg = note ?? connectState ?? prefsState;
  const verified = initial.status === "verified";

  const copy = (v: string) => {
    try {
      void navigator.clipboard.writeText(v);
      setCopied(v);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Card className="mt-4">
      <div id="email-sending" className="scroll-mt-6" />
      <CardTitle icon={<Mail size={15} />} title="Email sending" note={initial.domain ? `${initial.domain} · ${DOMAIN_STATUS_LABEL[initial.status ?? ""] ?? initial.status}` : "Sending via PrepFlow"} />
      <p className="text-[12.5px] mb-3 -mt-2" style={{ color: "var(--muted)" }}>
        Order confirmations, pick reminders, receipts and campaigns go to your customers from <strong style={{ color: "var(--ink)" }}>{initial.preview}</strong>. Replies come to {initial.replyTo || initial.ownerEmail}. Connect your own domain and they&rsquo;ll come from your address instead &mdash; better for recognition and for landing in the inbox.
      </p>

      {msg && (
        <p className="text-[12.5px] mb-3 px-3 py-2 rounded-md" style={{ background: msg.ok ? "color-mix(in srgb, var(--pine) 9%, transparent)" : "color-mix(in srgb, var(--clay) 10%, transparent)", color: msg.ok ? "var(--pine)" : "var(--clay)" }}>
          {msg.message}
        </p>
      )}

      {!initial.domain ? (
        <form action={connect} className="grid sm:grid-cols-[1fr_140px_1fr_auto] gap-2.5 items-end">
          <label className="text-[12px]" style={{ color: "var(--muted)" }}>
            Your sending domain
            <input name="domain" placeholder="mail.yourkitchen.ca" className={`${INP} mt-1`} style={inputStyle} disabled={!initial.enabled} />
          </label>
          <label className="text-[12px]" style={{ color: "var(--muted)" }}>
            From address
            <input name="fromLocal" defaultValue={initial.fromLocal} className={`${INP} mt-1`} style={inputStyle} disabled={!initial.enabled} />
          </label>
          <label className="text-[12px]" style={{ color: "var(--muted)" }}>
            Replies go to
            <input name="replyTo" type="email" defaultValue={initial.replyTo} placeholder={initial.ownerEmail} className={`${INP} mt-1`} style={inputStyle} />
          </label>
          <button type="submit" disabled={connecting || !initial.enabled} className="px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
            {connecting ? "Connecting…" : "Connect domain"}
          </button>
          <p className="sm:col-span-4 text-[11.5px] -mt-1" style={{ color: "var(--muted)" }}>
            We recommend a subdomain (mail. or send.) so your main domain&rsquo;s email is never affected. {!initial.enabled && "Email isn't configured on this deployment yet."}
          </p>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[11.5px] px-2 py-0.5 rounded-full font-medium" style={verified ? { background: "color-mix(in srgb, var(--pine) 12%, transparent)", color: "var(--pine)" } : { background: "var(--sand)", color: "var(--muted)" }}>
              {DOMAIN_STATUS_LABEL[initial.status ?? ""] ?? initial.status}
            </span>
            <button type="button" disabled={pending} onClick={() => start(async () => setNote(await checkEmailDomain()))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border disabled:opacity-50" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              <RefreshCw size={13} /> {pending ? "Checking…" : "Check DNS now"}
            </button>
            <button type="button" disabled={pending} onClick={() => { if (confirm("Remove this sending domain? Emails will go out via PrepFlow again.")) start(async () => setNote(await disconnectEmailDomain())); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium ml-auto disabled:opacity-50" style={{ color: "var(--clay)" }}>
              <Trash2 size={13} /> Remove
            </button>
          </div>
          {!verified && (
            <p className="text-[12.5px] mb-2" style={{ color: "var(--ink-soft)" }}>
              Add these records at your domain provider (GoDaddy, Namecheap, Cloudflare, Squarespace…), exactly as shown. Then come back and press <em>Check DNS now</em>. It usually verifies within an hour.
            </p>
          )}
          {initial.records.length > 0 && (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--line)" }}>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left" style={{ color: "var(--muted)", background: "var(--paper)" }}>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Host / name</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {initial.records.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      <td className="px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>{r.type}{r.priority != null ? ` (priority ${r.priority})` : ""}</td>
                      <td className="px-3 py-2 font-mono break-all" style={{ color: "var(--ink)" }}>
                        <button type="button" onClick={() => copy(r.name)} className="inline-flex items-center gap-1 text-left" title="Copy">
                          {r.name} <Copy size={11} style={{ color: copied === r.name ? "var(--pine)" : "var(--muted)" }} />
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono break-all max-w-[420px]" style={{ color: "var(--ink)" }}>
                        <button type="button" onClick={() => copy(r.value)} className="inline-flex items-center gap-1 text-left" title="Copy">
                          <span className="line-clamp-2">{r.value}</span> <Copy size={11} className="shrink-0" style={{ color: copied === r.value ? "var(--pine)" : "var(--muted)" }} />
                        </button>
                      </td>
                      <td className="px-3 py-2" style={{ color: r.status === "verified" ? "var(--pine)" : "var(--muted)" }}>{r.status === "verified" ? <span className="inline-flex items-center gap-1"><Check size={12} /> ok</span> : (r.status ?? "—").replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form action={savePrefs} className="grid sm:grid-cols-[140px_1fr_auto] gap-2.5 items-end mt-4">
            <label className="text-[12px]" style={{ color: "var(--muted)" }}>
              From address
              <div className="flex items-center gap-1 mt-1">
                <input name="fromLocal" defaultValue={initial.fromLocal} className={INP} style={inputStyle} />
              </div>
            </label>
            <label className="text-[12px]" style={{ color: "var(--muted)" }}>
              Replies go to
              <input name="replyTo" type="email" defaultValue={initial.replyTo} placeholder={initial.ownerEmail} className={`${INP} mt-1`} style={inputStyle} />
            </label>
            <button type="submit" disabled={savingPrefs} className="px-3.5 py-2 rounded-lg text-[13px] font-medium border disabled:opacity-50" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              {savingPrefs ? "Saving…" : "Save"}
            </button>
            <p className="sm:col-span-3 text-[11.5px] -mt-1" style={{ color: "var(--muted)" }}>
              Customers will see <strong style={{ color: "var(--ink)" }}>{initial.fromLocal}@{initial.domain}</strong> once verified.
            </p>
          </form>
        </>
      )}
    </Card>
  );
}

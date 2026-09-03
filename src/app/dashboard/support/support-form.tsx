"use client";

import { useState, useTransition } from "react";
import { LifeBuoy, Send, Check, Mail } from "lucide-react";
import { submitSupportRequest } from "./actions";

const INP = "w-full rounded-lg border px-3 py-2 text-[13.5px] outline-none";
const ST = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

const CATEGORIES = ["General", "Billing & payouts", "Orders & subscriptions", "Kitchen & inventory", "Bug report", "Feature request"] as const;

export function SupportForm({
  defaultEmail,
  supportEmail,
}: {
  defaultEmail: string;
  supportEmail: string | null;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setResult(null);
    start(async () => {
      const r = await submitSupportRequest({ email, subject, category, message });
      setResult(r);
      if (r.ok) {
        setSubject("");
        setMessage("");
      }
    });
  };

  if (result?.ok) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="grid place-items-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--pine) 14%, transparent)" }}>
          <Check size={24} style={{ color: "var(--pine)" }} />
        </div>
        <p className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Message sent</p>
        <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{result.message}</p>
        <button
          onClick={() => setResult(null)}
          className="mt-5 px-4 py-2 rounded-lg text-[13px] font-medium"
          style={{ background: "var(--pine)", color: "#f4f2ec" }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5">
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-4">
          <LifeBuoy size={17} style={{ color: "var(--pine)" }} />
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Contact support</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11.5px] block mb-1" style={{ color: "var(--muted)" }}>Your email (we'll reply here)</label>
            <input className={INP} style={ST} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kitchen.com" />
          </div>
          <div>
            <label className="text-[11.5px] block mb-1" style={{ color: "var(--muted)" }}>Topic</label>
            <select className={INP} style={ST} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-[11.5px] block mb-1" style={{ color: "var(--muted)" }}>Subject</label>
          <input className={INP} style={ST} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of what you need" maxLength={160} />
        </div>

        <div className="mt-3">
          <label className="text-[11.5px] block mb-1" style={{ color: "var(--muted)" }}>How can we help?</label>
          <textarea
            className={`${INP} resize-y`}
            style={ST}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the problem or question. Include what you were doing and any order/customer names if relevant."
            maxLength={5000}
          />
        </div>

        {result && !result.ok && (
          <p className="text-[12.5px] mt-2" style={{ color: "var(--clay)" }}>{result.message}</p>
        )}

        <button
          onClick={submit}
          disabled={pending}
          className="mt-4 flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium disabled:opacity-60"
          style={{ background: "var(--pine)", color: "#f4f2ec" }}
        >
          <Send size={15} /> {pending ? "Sending…" : "Send message"}
        </button>
      </div>

      <div className="rounded-xl border p-5 h-fit" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h3 className="text-[14px] font-semibold mb-2" style={{ color: "var(--ink)" }}>Other ways to reach us</h3>
        {supportEmail ? (
          <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 text-[13px] mb-3" style={{ color: "var(--pine)" }}>
            <Mail size={15} /> {supportEmail}
          </a>
        ) : (
          <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>Use the form and we'll email you back.</p>
        )}
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
          We usually reply within one business day. For anything urgent that's blocking orders, put
          &ldquo;URGENT&rdquo; in the subject.
        </p>
        <div className="mt-4 pt-4 text-[12.5px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
          Looking for how something works? The{" "}
          <a href="/dashboard/guide" className="font-medium" style={{ color: "var(--pine)" }}>in-app Guide</a>{" "}
          walks through every screen.
        </div>
      </div>
    </div>
  );
}

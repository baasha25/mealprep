"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Check, Plus, Gift, Send, ImagePlus, Loader2, X } from "lucide-react";
import { Field, INP, btnPrimary } from "@/components/ui";
import {
  createCoupon,
  createGiftCard,
  sendEmailCampaign,
  signCampaignImageUpload,
  type FormState,
} from "./actions";

const inputStyle = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <span className="text-[12.5px] flex items-center gap-1" style={{ color: state.ok ? "#5e7350" : "var(--clay)" }}>
      {state.ok && <Check size={14} />} {state.message}
    </span>
  );
}

export function CouponForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCoupon, { ok: false });
  const [type, setType] = useState<"percent" | "flat">("percent");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code">
          <input name="code" placeholder="FRESH10" className={INP} style={inputStyle} />
        </Field>
        <Field label={type === "percent" ? "Percent off" : "Amount off ($)"}>
          <input
            name="value"
            type="number"
            step={type === "percent" ? "1" : "0.01"}
            placeholder={type === "percent" ? "10" : "5.00"}
            className={INP}
            style={inputStyle}
          />
        </Field>
      </div>
      <div className="flex gap-1.5">
        {(["percent", "flat"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className="px-3 py-1.5 rounded-md text-[12.5px] font-medium border capitalize"
            style={{
              background: type === t ? "var(--ink)" : "transparent",
              color: type === t ? "#f4f2ec" : "var(--ink-soft)",
              borderColor: type === t ? "var(--ink)" : "var(--line)",
            }}
          >
            {t === "percent" ? "% off" : "$ off"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={btnPrimary}>
          <Plus size={15} /> {pending ? "Creating…" : "Create coupon"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function GiftCardForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createGiftCard, { ok: false });

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)">
          <input name="amount" type="number" step="0.01" placeholder="50.00" className={INP} style={inputStyle} />
        </Field>
        <Field label="Recipient email (optional)">
          <input name="recipientEmail" type="email" placeholder="friend@email.com" className={INP} style={inputStyle} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60" style={btnPrimary}>
          <Gift size={15} /> {pending ? "Issuing…" : "Issue gift card"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

const SEGMENTS: { key: "all" | "lapsed" | "subscribers"; label: string }[] = [
  { key: "all", label: "All customers" },
  { key: "lapsed", label: "Lapsed (45+ days)" },
  { key: "subscribers", label: "Active subscribers" },
];

export function CampaignForm() {
  const [pending, start] = useTransition();
  const [segment, setSegment] = useState<"all" | "lapsed" | "subscribers">("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FormState | null>(null);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setImgError("Please choose an image file.");
    if (file.size > 8 * 1024 * 1024) return setImgError("Image is over 8 MB — pick a smaller one.");
    setImgError(null);
    setImgBusy(true);
    try {
      const sig = await signCampaignImageUpload();
      if (!sig.ok) return setImgError(sig.message);
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("signature", sig.signature);
      body.append("folder", sig.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.secure_url) return setImgError("Upload failed. Try again.");
      setImageUrl(data.secure_url as string);
    } catch {
      setImgError("Upload failed — check your connection.");
    } finally {
      setImgBusy(false);
    }
  }

  const send = () =>
    start(async () => {
      setState(null);
      const r = await sendEmailCampaign({ segment, subject, message, imageUrl: imageUrl || undefined });
      setState(r);
      if (r.ok) {
        setSubject("");
        setMessage("");
        setImageUrl("");
      }
    });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>Send to</label>
        <div className="inline-flex rounded-lg border p-0.5 flex-wrap" style={{ borderColor: "var(--line)" }}>
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(s.key)}
              className="px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors"
              style={{
                background: segment === s.key ? "var(--pine)" : "transparent",
                color: segment === s.key ? "#f4f2ec" : "var(--muted)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={140}
          placeholder="We miss you — 15% off your next order"
          className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none"
          style={inputStyle}
        />
      </div>
      <div>
        <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Write your email… (blank lines become paragraphs)"
          className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none resize-y"
          style={inputStyle}
        />
        <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
          Formatting: <code>**bold**</code> · <code>[link text](https://…)</code> · a blank line starts a new paragraph.
        </p>
      </div>
      <div>
        <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: "var(--ink)" }}>Photo <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional — shows at the top of the email)</span></label>
        <div className="flex items-center gap-3">
          <div className="relative w-24 h-16 rounded-lg overflow-hidden grid place-items-center shrink-0" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Campaign" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus size={18} style={{ color: "var(--muted)" }} />
            )}
            {imgBusy && (
              <div className="absolute inset-0 grid place-items-center" style={{ background: "#00000055" }}>
                <Loader2 size={16} className="animate-spin" color="#fff" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={imgBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium disabled:opacity-60"
              style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}
            >
              <ImagePlus size={13} /> {imgBusy ? "Uploading…" : imageUrl ? "Replace" : "Add photo"}
            </button>
            {imageUrl && !imgBusy && (
              <button type="button" onClick={() => setImageUrl("")} className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--clay)" }}>
                <X size={12} /> Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
        </div>
        {imgError && <p className="text-[11.5px] mt-1.5" style={{ color: "var(--clay)" }}>{imgError}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={pending || !subject.trim() || !message.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
          style={btnPrimary}
        >
          <Send size={15} /> {pending ? "Sending…" : "Send campaign"}
        </button>
        {state && <Status state={state} />}
      </div>
    </div>
  );
}

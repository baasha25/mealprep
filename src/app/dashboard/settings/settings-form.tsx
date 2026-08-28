"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Store, Percent, Truck, Star, Bell, ImagePlus, Loader2, X } from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { updateSettings, signLogoUpload, type SettingsActionState } from "./actions";
import { TIERS, TIER_KEYS, feePctLabel, type TierKey } from "@/lib/tiers";
import { TIMEZONES } from "@/lib/cutoff";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type SettingsInitial = {
  name: string;
  brandColor: string;
  logoUrl: string;
  tier: TierKey;
  subDiscount: number;
  taxRate: number;
  platformFee: number;
  deliveryFee: number;
  processingFee: number;
  minOrder: number;
  minMeals: number;
  cutoff: string;
  timezone: string;
  fulfillment: "delivery" | "pickup" | "both";
  deliveryDays: Record<string, boolean>;
  pickupLocations: string[];
  loyaltyEnabled: boolean;
  notifyCutoff: boolean;
  notifyDeliveryDay: boolean;
  loyaltyPointsPerDollar: number;
  loyaltyRedeemCentsPerPoint: number;
  referralBonusPoints: number;
};

const inputStyle = {
  borderColor: "var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
} as const;

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-[11.5px] mt-1" style={{ color: "var(--clay)" }}>
      {msg}
    </p>
  );
}

/**
 * Merchant logo uploader. The file goes straight from the browser to Cloudinary
 * (signed on the server); we keep only the returned URL in a hidden field the
 * form submits. The preview sits on a subtle checker so a transparent logo reads
 * clearly. Degrades to a "not set up" note when Cloudinary isn't configured.
 */
function LogoUploadField({ initial }: { initial: string }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, SVG, JPG, or WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That logo is over 5 MB. Please choose a smaller file.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const sig = await signLogoUpload();
      if (!sig.ok) {
        setError(sig.message);
        return;
      }
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", sig.apiKey);
      body.append("timestamp", String(sig.timestamp));
      body.append("signature", sig.signature);
      body.append("folder", sig.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) {
        setError("Upload failed. Please try again.");
        return;
      }
      setUrl(data.secure_url as string);
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field
      label="Logo"
      className="mt-4"
      hint="Shown on your storefront header and in your dashboard. A PNG or SVG with a transparent background looks best — at least 200px tall."
    >
      <input type="hidden" name="logoUrl" value={url} />
      <div className="flex items-center gap-3">
        <div
          className="relative w-40 h-20 rounded-lg overflow-hidden grid place-items-center shrink-0"
          style={{
            border: "1px solid var(--line)",
            background:
              "repeating-conic-gradient(#0000000d 0% 25%, transparent 0% 50%) 50% / 16px 16px, var(--paper)",
          }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Logo preview" className="max-w-[88%] max-h-[80%] object-contain" />
          ) : (
            <ImagePlus size={20} style={{ color: "var(--muted)" }} />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center" style={{ background: "#00000055" }}>
              <Loader2 size={18} className="animate-spin" color="#fff" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-60"
            style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}
          >
            <ImagePlus size={14} /> {busy ? "Uploading…" : url ? "Replace logo" : "Upload logo"}
          </button>
          {url && !busy && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: "var(--clay)" }}
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
      {error && (
        <p className="text-[11.5px] mt-2" style={{ color: "var(--clay)" }}>
          {error}
        </p>
      )}
    </Field>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(updateSettings, { ok: false });
  const errors = state.errors ?? {};
  const [tier, setTier] = useState<TierKey>(initial.tier);

  return (
    <form action={formAction} className="space-y-4">
      {/* Brand */}
      <Card>
        <CardTitle icon={<Store size={15} />} title="Brand" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business name">
            <input
              name="name"
              defaultValue={initial.name}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.name} />
          </Field>
          <Field label="Brand color" hint="Drives the dashboard accent (--pine).">
            <div className="flex items-center gap-2">
              <input
                type="color"
                name="brandColor"
                defaultValue={initial.brandColor}
                className="h-9 w-12 rounded-md border cursor-pointer"
                style={{ borderColor: "var(--line)" }}
                onChange={(e) => {
                  const hex = e.currentTarget.parentElement?.querySelector<HTMLInputElement>(
                    "input[data-hex]",
                  );
                  if (hex) hex.value = e.currentTarget.value;
                }}
              />
              <input
                data-hex
                name="brandColorHex"
                defaultValue={initial.brandColor}
                className={INP}
                style={inputStyle}
                readOnly
              />
            </div>
            <ErrorText msg={errors.brandColor} />
          </Field>
        </div>
        <LogoUploadField initial={initial.logoUrl} />
      </Card>

      {/* Pricing & fees */}
      <Card>
        <CardTitle
          icon={<Percent size={15} />}
          title="Pricing & fees"
          note="Stored as integer cents / basis points"
        />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Subscription discount (%)" hint="The discount subscribers get vs. ordering one-off — applied to their subtotal before tax.">
            <input
              name="subDiscount"
              type="number"
              step="0.01"
              defaultValue={initial.subDiscount}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.subDiscount} />
          </Field>
          <Field label="Tax rate (%)" hint="Sales tax charged to customers, on the discounted subtotal. Use your local rate (e.g. 13% HST).">
            <input
              name="taxRate"
              type="number"
              step="0.01"
              defaultValue={initial.taxRate}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.taxRate} />
          </Field>
          <Field
            label="PrepFlow plan"
            hint={`Sets your platform fee automatically — ${feePctLabel(tier)}.`}
          >
            <input type="hidden" name="tier" value={tier} />
            <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
              {TIER_KEYS.map((k) => {
                const on = tier === k;
                return (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setTier(k)}
                    className="flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors"
                    style={{ background: on ? "var(--pine)" : "transparent", color: on ? "#f4f2ec" : "var(--muted)" }}
                    title={`$${Math.round(TIERS[k].priceCents / 100)}/mo · ${feePctLabel(k)} fee`}
                  >
                    {TIERS[k].name}
                  </button>
                );
              })}
            </div>
            <ErrorText msg={errors.tier} />
          </Field>
          <Field label="Delivery fee ($)" hint="Flat fee added to delivery orders.">
            <input
              name="deliveryFee"
              type="number"
              step="0.01"
              defaultValue={initial.deliveryFee}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.deliveryFee} />
          </Field>
          <Field label="Processing fee ($)" hint="Flat per-order fee (e.g. packaging/handling). Separate from Stripe's card processing.">
            <input
              name="processingFee"
              type="number"
              step="0.01"
              defaultValue={initial.processingFee}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.processingFee} />
          </Field>
          <Field label="Minimum order ($)" hint="Orders below this can't check out. 0 = no minimum.">
            <input
              name="minOrder"
              type="number"
              step="0.01"
              defaultValue={initial.minOrder}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.minOrder} />
          </Field>
          <Field label="Minimum meals / order">
            <input
              name="minMeals"
              type="number"
              step="1"
              defaultValue={initial.minMeals}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.minMeals} />
          </Field>
        </div>
      </Card>

      {/* Fulfillment */}
      <Card>
        <CardTitle icon={<Truck size={15} />} title="Fulfillment" />
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Field label="Order cut-off" hint="The deadline before a delivery when customers can still change, skip, or swap meals. After it, that delivery is locked so you can shop and prep.">
            <input
              name="cutoff"
              defaultValue={initial.cutoff}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.cutoff} />
          </Field>
          <Field label="Cut-off timezone" hint="The timezone your cut-off time is in — powers the countdown clock shown on your storefront.">
            <select name="timezone" defaultValue={initial.timezone} className={INP} style={inputStyle}>
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Fulfillment options">
            <select
              name="fulfillment"
              defaultValue={initial.fulfillment}
              className={INP}
              style={inputStyle}
            >
              <option value="both">Delivery & pickup</option>
              <option value="delivery">Delivery only</option>
              <option value="pickup">Pickup only</option>
            </select>
            <ErrorText msg={errors.fulfillment} />
          </Field>
        </div>
        <Field label="Delivery days" className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <label
                key={d}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12.5px] cursor-pointer select-none"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <input
                  type="checkbox"
                  name={`day_${d}`}
                  defaultChecked={initial.deliveryDays[d] ?? false}
                />
                {d}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Pickup locations" hint="One per line.">
          <textarea
            name="pickupLocations"
            rows={3}
            defaultValue={initial.pickupLocations.join("\n")}
            className={`${INP} resize-y`}
            style={inputStyle}
          />
        </Field>
      </Card>

      {/* Loyalty & referrals */}
      <Card>
        <CardTitle icon={<Star size={15} />} title="Loyalty & referrals" />
        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input type="checkbox" name="loyaltyEnabled" defaultChecked={initial.loyaltyEnabled} />
          <span className="text-[13px]" style={{ color: "var(--ink)" }}>
            Enable loyalty points & referrals
          </span>
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Points earned per $1" hint="Loyalty points a customer earns per $1 of order subtotal (before discounts).">
            <input
              name="loyaltyPointsPerDollar"
              type="number"
              step="1"
              min="0"
              defaultValue={initial.loyaltyPointsPerDollar}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.loyaltyPointsPerDollar} />
          </Field>
          <Field label="Redemption value (¢ / point)" hint="e.g. 5 = 1 point is worth 5¢.">
            <input
              name="loyaltyRedeemCentsPerPoint"
              type="number"
              step="1"
              min="1"
              defaultValue={initial.loyaltyRedeemCentsPerPoint}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.loyaltyRedeemCentsPerPoint} />
          </Field>
          <Field label="Referral bonus (points)" hint="Awarded to the referrer per signup.">
            <input
              name="referralBonusPoints"
              type="number"
              step="1"
              min="0"
              defaultValue={initial.referralBonusPoints}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.referralBonusPoints} />
          </Field>
        </div>
      </Card>

      {/* Customer notifications */}
      <Card>
        <CardTitle icon={<Bell size={15} />} title="Customer notifications" />
        <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
          Automatic reminders emailed to your subscribers around each delivery.
        </p>
        <label className="flex items-start gap-2 mb-2.5 cursor-pointer select-none">
          <input type="checkbox" name="notifyCutoff" defaultChecked={initial.notifyCutoff} className="mt-0.5" />
          <span>
            <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Cut-off reminder</span>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>“Edit your box before cut-off” — sent ~1 day before changes lock.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input type="checkbox" name="notifyDeliveryDay" defaultChecked={initial.notifyDeliveryDay} className="mt-0.5" />
          <span>
            <span className="text-[13px] block" style={{ color: "var(--ink)" }}>Delivery-day email</span>
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>“Your meals arrive today” — sent the morning of delivery.</span>
          </span>
        </label>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-medium disabled:opacity-60"
          style={btnPrimary}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.ok && state.message && (
          <span
            className="flex items-center gap-1 text-[13px]"
            style={{ color: "#5e7350" }}
          >
            <Check size={15} /> {state.message}
          </span>
        )}
        {!state.ok && state.message && (
          <span className="text-[13px]" style={{ color: "var(--clay)" }}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

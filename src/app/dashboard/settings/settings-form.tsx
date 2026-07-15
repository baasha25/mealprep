"use client";

import { useActionState, useState } from "react";
import { Check, Store, Percent, Truck, Star, Bell } from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { updateSettings, type SettingsActionState } from "./actions";
import { TIERS, TIER_KEYS, feePctLabel, type TierKey } from "@/lib/tiers";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type SettingsInitial = {
  name: string;
  brandColor: string;
  tier: TierKey;
  subDiscount: number;
  taxRate: number;
  platformFee: number;
  deliveryFee: number;
  processingFee: number;
  minOrder: number;
  minMeals: number;
  cutoff: string;
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
      </Card>

      {/* Pricing & fees */}
      <Card>
        <CardTitle
          icon={<Percent size={15} />}
          title="Pricing & fees"
          note="Stored as integer cents / basis points"
        />
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Subscription discount (%)">
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
          <Field label="Tax rate (%)">
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
          <Field label="Delivery fee ($)">
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
          <Field label="Processing fee ($)">
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
          <Field label="Minimum order ($)">
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
          <Field label="Order cut-off">
            <input
              name="cutoff"
              defaultValue={initial.cutoff}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.cutoff} />
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
          <Field label="Points earned per $1">
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

"use client";

import { useActionState } from "react";
import { Check, Store, Percent, Truck } from "lucide-react";
import { Card, CardTitle, Field, INP, btnPrimary } from "@/components/ui";
import { updateSettings, type SettingsActionState } from "./actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type SettingsInitial = {
  name: string;
  brandColor: string;
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
            label="Platform fee (%)"
            hint="PrepFlow application fee. Configurable, not hardcoded."
          >
            <input
              name="platformFee"
              type="number"
              step="0.01"
              defaultValue={initial.platformFee}
              className={INP}
              style={inputStyle}
            />
            <ErrorText msg={errors.platformFee} />
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

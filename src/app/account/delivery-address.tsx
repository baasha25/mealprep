"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Check, Pencil } from "lucide-react";
import { saveDeliveryAddress } from "./actions";

export type SavedAddress = {
  line1: string;
  city: string | null;
  region: string | null;
  postalCode: string | null;
};

const input = { borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" } as const;

export function DeliveryAddress({ initial }: { initial: SavedAddress | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!initial);
  const [toast, setToast] = useState<string | null>(null);
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");

  const oneLine = initial
    ? [initial.line1, initial.city, initial.region, initial.postalCode].filter(Boolean).join(", ")
    : "";

  const save = () =>
    start(async () => {
      const r = await saveDeliveryAddress({ line1, city, region, postalCode });
      setToast(r.message ?? (r.ok ? "Saved." : "Something went wrong."));
      setTimeout(() => setToast(null), 3000);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin size={16} style={{ color: "var(--muted)" }} />
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Delivery address</h3>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[12.5px] font-medium" style={{ color: "var(--pine)" }}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>

      {toast && (
        <div className="fade mb-3 px-3 py-2 rounded-lg text-[12.5px] flex items-center gap-1.5" style={{ background: "color-mix(in srgb, var(--pine) 9%, transparent)", color: "var(--pine)" }}>
          <Check size={13} /> {toast}
        </div>
      )}

      {!editing ? (
        <p className="text-[13.5px]" style={{ color: oneLine ? "var(--ink)" : "var(--muted)" }}>
          {oneLine || "No delivery address on file."}
        </p>
      ) : (
        <div className="space-y-2.5">
          <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" className="w-full rounded-lg border px-3 py-2.5 text-[14px] outline-none" style={input} />
          <div className="grid grid-cols-3 gap-2.5">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="rounded-lg border px-3 py-2.5 text-[14px] outline-none" style={input} />
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Province/State" className="rounded-lg border px-3 py-2.5 text-[14px] outline-none" style={input} />
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" className="rounded-lg border px-3 py-2.5 text-[14px] outline-none" style={input} />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={pending || !line1.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50" style={{ background: "var(--pine)", color: "#f4f2ec" }}>
              <Check size={15} /> {pending ? "Saving…" : "Save address"}
            </button>
            {initial && (
              <button onClick={() => setEditing(false)} disabled={pending} className="text-[13px] font-medium" style={{ color: "var(--muted)" }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

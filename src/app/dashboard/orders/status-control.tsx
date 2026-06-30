"use client";

import { useRef } from "react";
import { ORDER_STATUSES, STATUS_META } from "@/lib/order-status";

export function StatusControl({
  orderId,
  status,
  action,
}: {
  orderId: string;
  status: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const meta = STATUS_META[status as keyof typeof STATUS_META];

  return (
    <form ref={ref} action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => ref.current?.requestSubmit()}
        className="text-[12px] font-medium px-2 py-1 rounded-md border cursor-pointer outline-none"
        style={{
          color: meta?.fg ?? "var(--ink)",
          background: meta?.bg ?? "var(--sand)",
          borderColor: "transparent",
        }}
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s} style={{ background: "var(--surface)", color: "var(--ink)" }}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
    </form>
  );
}

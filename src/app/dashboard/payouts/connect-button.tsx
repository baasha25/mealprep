"use client";

import { useState, useTransition } from "react";
import { Landmark } from "lucide-react";
import { startConnectOnboarding } from "./actions";

export function ConnectButton({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  return (
    <>
      <button
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await startConnectOnboarding();
            if (r.ok) window.location.href = r.url;
            else setErr(r.message);
          })
        }
        disabled={pending}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13.5px] font-medium disabled:opacity-60"
        style={{ background: "var(--pine)", color: "#f4f2ec" }}
      >
        <Landmark size={16} /> {pending ? "Opening Stripe…" : label}
      </button>
      {err && (
        <p className="text-[12.5px] mt-2" style={{ color: "var(--clay)" }}>
          {err}
        </p>
      )}
    </>
  );
}

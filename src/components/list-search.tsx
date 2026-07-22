"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Debounced list search box. Updates the URL `?q=` on the given basePath so the
 * server page can filter. Reusable across list pages (customers, orders, …).
 */
export function ListSearch({
  placeholder,
  basePath,
  initialQ = "",
}: {
  placeholder: string;
  basePath: string;
  initialQ?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      router.replace(q.trim() ? `${basePath}?q=${encodeURIComponent(q.trim())}` : basePath);
    }, 300);
    return () => clearTimeout(t);
  }, [q, basePath, router]);

  return (
    <div className="relative mb-4 max-w-md">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--muted)" }}
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border pl-9 pr-9 py-2.5 text-[13.5px] outline-none"
        style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-6 h-6 rounded-md"
          aria-label="Clear search"
        >
          <X size={14} style={{ color: "var(--muted)" }} />
        </button>
      )}
    </div>
  );
}

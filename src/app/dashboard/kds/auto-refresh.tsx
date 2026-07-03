"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keep the line board live: re-pull server state on an interval so every
// station's screen stays in sync as tickets are bumped.
export function AutoRefresh({ seconds = 12 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

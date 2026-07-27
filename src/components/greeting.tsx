"use client";

import { useEffect, useState } from "react";

/**
 * Time-of-day greeting computed from the VIEWER's local clock (not the server's,
 * which is UTC). Renders a neutral greeting on first paint to avoid a hydration
 * mismatch, then updates to morning/afternoon/evening after mount.
 */
export function Greeting({ name }: { name?: string }) {
  const [tod, setTod] = useState<string | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setTod(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const greeting = tod ?? "Welcome back";
  return (
    <>
      {greeting}
      {name ? `, ${name}` : ""}
    </>
  );
}

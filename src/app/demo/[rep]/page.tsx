import type { Metadata } from "next";
import { DemoTour } from "../demo-tour";

/** Title-case a rep slug for display: "sales-mike" → "Sales Mike". */
function repDisplayName(rep: string | null): string | null {
  if (!rep) return null;
  const cleaned = rep.replace(/[^a-z0-9]+/gi, " ").trim();
  if (!cleaned) return null;
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PrepFlow — Guided demo",
  description: "A guided walkthrough of PrepFlow for independent meal-prep kitchens.",
};

// Rep-attributed demo link: /demo/<rep-slug>. The slug is normalized to a
// lowercase attribution campaign so the signup is credited to this rep in
// /admin; a title-cased version is shown in the header ("with Mike").
export default async function DemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ rep: string }>;
  searchParams: Promise<{ brand?: string; color?: string; logo?: string; keep?: string }>;
}) {
  const { rep } = await params;
  // Branded prospect demo params ride along to the /enter door.
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const k of ["brand", "color", "logo", "keep"] as const) if (sp[k]) q.set(k, String(sp[k]));
  const enterQuery = q.toString();
  const slug = decodeURIComponent(rep).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return <DemoTour rep={slug || null} repName={repDisplayName(slug)} enterQuery={enterQuery} />;
}

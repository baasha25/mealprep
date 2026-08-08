import type { Metadata } from "next";
import Link from "next/link";
import { EnterDemoForm } from "./enter-form";
import { demoEnabled } from "@/lib/demo-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PrepFlow — Open the live demo",
  robots: { index: false, follow: false },
};

/** Title-case a rep slug for display: "sales-mike" → "Sales Mike". */
function repDisplayName(rep: string): string | null {
  const cleaned = rep.replace(/[^a-z0-9]+/gi, " ").trim();
  if (!cleaned) return null;
  return cleaned.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default async function EnterDemoPage({
  params,
}: {
  params: Promise<{ rep: string }>;
}) {
  const { rep } = await params;
  const slug = decodeURIComponent(rep).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  // Door not configured → don't tease a code prompt that can't work.
  if (!demoEnabled()) {
    return (
      <div className="min-h-screen grid place-items-center px-6 py-12" style={{ background: "var(--paper)" }}>
        <div className="max-w-[420px] text-center">
          <h1 className="disp text-[24px] font-medium" style={{ color: "var(--ink)" }}>
            The live demo isn&apos;t switched on yet
          </h1>
          <p className="mt-2 text-[14px]" style={{ color: "var(--muted)" }}>
            Set <code>DEMO_PASSCODE</code> and <code>DEMO_SECRET</code> to enable it. In the meantime,
            the walkthrough is ready to go.
          </p>
          <Link
            href={`/demo/${slug || ""}`}
            className="inline-flex items-center mt-5 px-4 py-2.5 rounded-xl text-[14px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            Back to the walkthrough
          </Link>
        </div>
      </div>
    );
  }

  return <EnterDemoForm rep={slug} repName={repDisplayName(slug)} />;
}

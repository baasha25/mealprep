import { Wand2 } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin";
import { appUrl } from "@/lib/app-url";
import { DemoLinkBuilder } from "./builder";

export const dynamic = "force-dynamic";

export default async function DemoLinksPage() {
  await requireSuperAdmin();
  const origin = (await appUrl()) || "https://prepflow.ca";
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <Wand2 size={20} style={{ color: "var(--pine)" }} />
        <h1 className="disp text-[22px] font-medium" style={{ color: "var(--ink)" }}>Demo link builder</h1>
      </div>
      <p className="text-[13.5px] mb-6 max-w-2xl" style={{ color: "var(--muted)" }}>
        Make a demo that opens already looking like the prospect&apos;s kitchen — their name, colour and logo — and stays alive for a
        few days so whatever you set up on the call is still there when they log back in. Send the link (with the access code) to the prospect or use it yourself.
      </p>
      <DemoLinkBuilder origin={origin} />
    </div>
  );
}

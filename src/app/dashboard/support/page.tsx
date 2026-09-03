import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { SupportForm } from "./support-form";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const { business } = await requireBusiness();

  // Prefill the reply-to with the kitchen's owner email (best-effort).
  const owner = await db.user.findFirst({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null;

  return (
    <Page>
      <Head
        kicker="Help"
        title="Contact support"
        sub="Stuck on something, or spotted a bug? Send us a message and we'll get back to you by email."
      />
      <SupportForm defaultEmail={owner?.email ?? ""} supportEmail={supportEmail} />
    </Page>
  );
}

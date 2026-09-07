import { requireBusiness } from "@/lib/auth";
import { Page, Head } from "@/components/ui";
import { ANTHROPIC_ENABLED } from "@/lib/anthropic";
import { MenuScanner } from "./menu-scanner";

export const dynamic = "force-dynamic";

export default async function MenuImportPage() {
  await requireBusiness();
  return (
    <Page>
      <Head
        kicker="Menu"
        title="Import menu from a photo"
        sub="Upload a photo or PDF of your existing menu and PrepFlow builds your menu items for you — dishes, prices, and descriptions. Review before anything is added."
      />
      <MenuScanner enabled={ANTHROPIC_ENABLED} />
    </Page>
  );
}

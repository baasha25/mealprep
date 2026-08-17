import { requireBusiness } from "@/lib/auth";
import { Page, Head } from "@/components/ui";
import { GuideView } from "./guide-view";

export const metadata = { title: "Guide — PrepFlow" };

export default async function GuidePage() {
  // Any signed-in user (owner or staff) can read the guide; require a session
  // so it lives inside the dashboard shell like every other page.
  await requireBusiness();

  return (
    <Page>
      <Head
        kicker="Help"
        title="Guide"
        sub="Every screen and every number, explained in plain English. Search a topic or jump to any section — use it whenever you're stuck."
      />
      <GuideView />
    </Page>
  );
}

import { Page, Head } from "@/components/ui";
import { Importer } from "./importer";

export default function ImportPage() {
  return (
    <Page>
      <Head
        kicker="Migration"
        title="Import your data"
        sub="Switching from another platform? Bring your menu, customers, and active subscriptions over in minutes."
      />
      <Importer />
    </Page>
  );
}
